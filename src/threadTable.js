import {startWorker} from './manageWorkers.js';
import {SYSBUF_OFFSET, OSOAP_SYS} from './constants/syscallBufferLayout.js';
import {SIG} from './constants/signal.js';
import {dispatchSyscall} from './syscall/dispatch.js';
import {FileDescriptor, FileDescriptorTable} from './FileDescriptor.js';
import {devConsole} from './OpenFileDescription.js';

const FIRST_UNUSABLE_PID = Math.pow(2, 31);
let tidCounter = 1; // Start PIDs at 1

const getNewTid = () => {
  const oldTid = tidCounter;
  if (oldTid >= FIRST_UNUSABLE_PID)  {
    throw new Error("32-bit tids exhausted - move to 64 bits");
  }
  tidCounter += 1;
  return oldTid;
};

const PROCESS_STATUS_STATE = {
  RUNNING: 'running',
  CONTINUED: 'continued',
  TERMINATED: 'terminated',
};

// TODO: removing the ZOMBIE state and separately tracking zombie threads
// in the process would make a lot of sense.
const THREAD_STATE = {
  INIT: 'init',
  RUNNING: 'running',
  SYSCALL: 'syscall',
  DETACHED: 'detached',
};

const sessions = new Map();

class Session {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.controllingTerminal = null;
    this.processGroups = new Map();
    sessions.set(this.sessionId, this);
  }

  joinSession(processGroup) {
    this.processGroups.set(processGroup.processGroupId, processGroup);
  }

  leaveSession(processGroup) {
    this.processGroups.delete(processGroup.processGroupId);
    if (this.processGroups.size === 0) this.dispose();
  }

  dispose() {
    sessions.delete(this.sessionId);
  }
}

const processGroups = new Set();

class ProcessGroup {
  constructor(session, processGroupId) {
    this.session = session;
    this.processGroupId = processGroupId;
    this.processes = new Map();
    this.session.joinSession(this);
    processGroups.add(this.processGroupId);
    this.session.joinSession(this);
  }

  joinProcessGroup(process) {
    this.processes.set(process.processId, process);
  }

  leaveProcessGroup(process) {
    this.processes.delete(process.processId);
    if (this.processes.size === 0) this.dispose();
  }

  dispose() {
    processGroups.delete(this.processGroupId);
    this.session.leaveSession(this);
    this.session = null;
  }
}

const pidTable = new Map();

class Process {
  constructor(processGroup, parentProcess, processId) {
    this.compiledModule = null;
    this.memory = null;
    this.status = null;
    this.isZombie = false;
    this.processGroup = processGroup;
    this.parentProcess = parentProcess;
    this.processId = processId;
    this.setUserId = {real: null, effective: null, saved: null};
    this.setGroupId = {real: null, effective: null, saved: null};
    this.currentWorkingDirectory = null;
    this.rootDirectory = null;
    this.fileModeCreationMask = null;
    this.fdtable = new FileDescriptorTable([new FileDescriptor(devConsole, false), new FileDescriptor(devConsole, false), new FileDescriptor(devConsole, false)]);
    this.threads = new Map();

    pidTable.set(this.processId, this);
    this.processGroup.joinProcessGroup(this);
  }

  isSessionLeader() {
    return this.processId === this.processGroup.session.sessionId;
  }

  wasProcessGroupLeader() {
    return processGroups.has(this.processId);
  }

  notifyDeadChild(process) {
    void process;
    // TODO: wake up relevant wait calls, emit SIGCHLD
    // TODO: return true when SIGCHLD has SA_NOCLDWAIT or is set to SIG_IGN
    return false;
  }

  registerModuleAndMemory({compiledModule, memory}) {
    this.compiledModule = compiledModule;
    this.memory = memory;
  }

  // exit may be called multiple times, should be a noop after the first
  exit(exitCode) {
    // exitCode should be an int32 that is the value passed to _Exit
    // TODO: store the actual exit code to return with waitid
    this.terminate_((exitCode & 0xff) << 8);
    for (const thread of this.threads.values()) {
      thread.hangup();
    }
  }

  // Completes immediately, can force a exit to hurry up, without changing
  // the exit status. Is that the desired behavior?
  kill() {
    this.terminate_(SIG.KILL);
    for (const thread of this.threads.values()) {
      thread.terminate_now();
    }
  }

  joinProcess(thread) {
    if (this.isZombie) return;
    this.threads.set(thread.threadId, thread);
  }

  leaveProcess(thread) {
    this.threads.delete(thread.threadId);
    if (this.threads.size === 0) {
      // In normal operation, this exit should be a noop,
      // since the last thread should have called exit first.
      this.exit(0);
    }
  }

  terminate_(reason) {
    if (this.isZombie) return;
    this.isZombie = true;
    console.log(`Process ${this.processId} terminated.`);
    this.fdtable.tearDown();
    this.fdtable = null;
    this.status = {
      state: PROCESS_STATUS_STATE.TERMINATED,
      reason: reason,
    };
    if (this.parentProcess?.notifyDeadChild(this)) {
      // reap yourself
      this.reap();
    }
    // TODO: All children of this process (including zombies)
    // should be adopted by init.
    // As part of this, call init.notifyDeadChild(child) for zombies.
    if (this.isSessionLeader()) {
      const session = this.processGroup.session;
      session.terminal?.hangup();
      session.terminal = null;
    }
    // Orphaned process group: A process group in which the parent of every member is either itself a member of the group or is not a member of the group's session.
    // TODO: If the exit of the process causes a process group to become orphaned, and if any member of the newly-orphaned process group is stopped, then a SIGHUP signal followed by a SIGCONT signal shall be sent to each process in the newly-orphaned process group.
    // TODO: analyze interaction with asynchronous IO, when we have aio.

    // Other things that happen on termination, according to
    // https://pubs.opengroup.org/onlinepubs/9699919799/functions/_Exit.html
    // We have skipped bullets talking about
    // * shared memory
    // * semaphores
    // * memory locks
    // * memory mappings
    // * typed memory
    // * message queues
  }

  // TODO: also call after parent reaps this process with wait
  reap() {
    this.status = null;
    this.processGroup.leaveProcessGroup(this);
    this.processGroup = null;
    pidTable.delete(this.processId);
  }
}

const syscallReturnToUser = (sync) => {
  Atomics.store(sync, 0, OSOAP_SYS.TURN.USER);
  Atomics.notify(sync, 0, 1);
};

const notifyDetachedState = (sync) => {
  Atomics.store(sync, 0, OSOAP_SYS.TURN.DETACHED);
  Atomics.notify(sync, 0);
};

// How long user programs have to exit when asked
// before they are forcibly terminated.
const TIME_TO_DIE_MS = 30 * 1000;

class Thread {
  constructor(executableUrl, process, threadId) {
    this.state = THREAD_STATE.INIT;
    this.executableUrl = executableUrl;
    this.process = process;
    this.threadId = threadId;
    this.sysBufAddr = 0;
    this.signalInterruptController = null;
    this.terminateWorker = null;
    this.process.joinProcess(this);
    this.signalMask = new Uint32Array(2); // TODO: copy from parent
  }

  // get memory() { return this.process.memory; }

  // Should only be called in the RUNNING or SYSCALL states
  syncWord() {
    return new Int32Array(
      this.process.memory.buffer,
      this.sysBufAddr + SYSBUF_OFFSET.sync_word,
      1,
    );
  }

  // Should only be called in the RUNNING or SYSCALL states
  flagWord() {
    return new Uint32Array(
      this.process.memory.buffer,
      this.sysBufAddr + SYSBUF_OFFSET.flag_word,
      1,
    );
  }

  // Processing should not continue for this process after calling this function.
  // Consider making it throw an error that must be caught.
  // (With the consequence that an uncought error could crash the kernel.)
  userMisbehaved(message) {
    console.log("User Misbehaved:", message);
    debugger;
    if (this.process === null) return;
    this.process.kill();
  }

  registerSysBuf(message) {
    if (this.process.memory === null) {
      throw new Error("Messages passed out-of-order along message queue; registerSysBuf arrived before shareModuleAndMemory");
    }
    const memory = this.process.memory;
    const buffer = memory.buffer;
    const sysBufAddr = message.sysBuf;
    if (sysBufAddr & 3) {
      this.userMisbehaved("sysBuf is not 4 byte aligned");
      return;
    }
    if (sysBufAddr < 0 || sysBufAddr + SYSBUF_OFFSET.length > buffer.byteLength) {
      this.userMisbehaved("sysBuf out of range");
      return;
    }
    if (this.state === THREAD_STATE.DETACHED) {
      const sync = new Int32Array(
        buffer,
        sysBufAddr + SYSBUF_OFFSET.sync_word,
        1,
      );
      this.notifyDetachedState(sync);
    } else if (this.state === THREAD_STATE.INIT) {
      this.state = THREAD_STATE.RUNNING;
      this.sysBufAddr = sysBufAddr;
      this.listenForSyscall();
    } else {
      this.userMisbehaved("Double register sysBuf");
    }
  }

  async listenForSyscall() {
    // It would be reasonable to proceed synchronously
    // with either or both of waitAsync and respondToSyscall
    // in the case that they do not need to do any async operations.
    // This is an optimization opportunity.
    // If we make both possibly synchronous, have the worry that
    // we starve the event loop.
    let sync = this.syncWord();
    while (true) {
      await Atomics.waitAsync(sync, 0, OSOAP_SYS.TURN.USER).value;
      if (this.state !== THREAD_STATE.RUNNING) break;
      this.state = THREAD_STATE.SYSCALL;
      await this.respondToSyscall();
      if (this.state !== THREAD_STATE.SYSCALL) break;
      sync = this.syncWord();
      syscallReturnToUser(sync);
      this.state = THREAD_STATE.RUNNING;
    }
  }

  respondToSyscall() {
    const dv = new DataView(this.process.memory.buffer);
    const syscall_tag = dv.getUint32(this.sysBufAddr + SYSBUF_OFFSET.tag, true);
    return dispatchSyscall(syscall_tag)(dv, this);
  }

  // Should only be called in the RUNNING or SYSCALL states
  requestUserDebugger() {
    Atomics.or(this.flagWord(), 0, OSOAP_SYS.FLAG.DEBUGGER);
  }

  // TODO: can probably be removed
  // Should only be called in the RUNNING or SYSCALL states
  requestUserExit() {
    Atomics.or(this.flagWord(), 0, OSOAP_SYS.FLAG.EXIT);
  }

  // Set this.return_value by calling exit
  // Detaches the syscall buffer, asks the user program to exit,
  // and cleans up other resources owned by the thread.
  // This is the canonical way of entering the detached state.
  hangup() {
    if (this.state === THREAD_STATE.DETACHED) return;
    this.state = THREAD_STATE.DETACHED;
    // Arrange to clean up abruptly if the user program isn't cooperative.
    setTimeout(this.terminate_now.bind(this), TIME_TO_DIE_MS);
    if (this.state !== THREAD_STATE.INIT) {
      notifyDetachedState(this.syncWord());
    }
    this.signalInterruptController?.abort();
    this.process.leaveProcess(this);
    this.process = null;
  }

  terminate_now() {
    this.terminateWorker?.();
    this.terminateWorker = null;
    this.hangup();
  }

  onExit() {
    this.terminateWorker = null;
    if (this.state === THREAD_STATE.DETACHED) {
      console.log(`Thread ${this.threadId} exited.`);
    } else {
      this.userMisbehaved("Exit without detaching");
    }
  }

  onError(e) {
    // This worker has been released; be careful to not double-release it
    // as we take the whole process down.
    this.terminateWorker = null;
    this.userMisbehaved(`Error bubbled up from worker: ${e}`);
  }
}

//const processTable = new Map();

const spawnProcess = (executableUrl) => {
  const tid = getNewTid();
  const session = new Session(tid);
  const processGroup = new ProcessGroup(session, tid);
  const process = new Process(processGroup, null, tid);
  const thread = new Thread(executableUrl, process, tid);
  thread.terminateWorker = startWorker(thread);
};

export {spawnProcess};
