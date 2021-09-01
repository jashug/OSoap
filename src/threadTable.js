import {startWorker} from './manageWorkers.js';
import {SYSBUF_OFFSET, OSOAP_SYS} from './constants/syscallBufferLayout.js';
import {SIG} from './constants/signal.js';
import {dispatchSyscall} from './syscall/dispatch.js';
import {FileDescriptor, FileDescriptorTable} from './FileDescriptor.js';
import {OpenFileDescription} from './OpenFileDescription.js';

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

const THREAD_STATE = {
  INIT: 'init',
  RUNNING: 'running',
  SYSCALL: 'syscall',
  DETACHED: 'detached',
  ZOMBIE: 'zombie',
};

const sessions = new Map();

class Session {
  constructor(sessionId = getNewTid()) {
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
  constructor(session, processGroupId = getNewTid()) {
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
  }
}

class Process {
  constructor(processGroup, parentProcessId, processId = getNewTid()) {
    this.compiledModule = null;
    this.memory = null;
    this.processGroup = processGroup;
    this.processId = processId;
    this.setUserId = {real: null, effective: null, saved: null};
    this.setGroupId = {real: null, effective: null, saved: null};
    this.currentWorkingDirectory = null;
    this.rootDirectory = null;
    this.fileModeCreationMask = null;
    this.fdtable = null; // TODO: Move fdtable from thread to process.
    this.threads = new Map();
    this.wstatus = 0x1234; // Valid in DETACHED and ZOMBIE states
    this.processGroup.joinProcessGroup(this);
  }

  isSessionLeader() {
    return this.processId === this.processGroup.session.sessionId;
  }

  wasProcessGroupLeader() {
    return processGroups.has(this.processId);
  }

  registerModuleAndMemory({compiledModule, memory}) {
    this.compiledModule = compiledModule;
    this.memory = memory;
  }

  exit(exitCode) {
    // exitCode should be an int32 that is the value passed to _Exit
    // TODO: store the actual exit code to return with waitid
    // TODO: make sure this handles process lifetime correctly
    this.wstatus = (exitCode & 0xff) << 8;
    for (const thread of this.threads.values()) {
      thread.hangup();
    }
    console.log(`Process ${this.processId} exited with exit code ${exitCode}.`);
  }

  kill() {
    this.wstatus = SIG.KILL;
    // TODO: make sure this handles process lifetime correctly
    for (const thread of this.threads.values()) {
      thread.terminate_now();
    }
  }

  joinProcess(thread) {
    this.threads.set(thread.threadId, thread);
  }

  leaveProcess(thread) {
    this.threads.delete(thread.threadId);
    if (this.threads.size === 0) this.dispose();
  }

  dispose() {
    this.processGroup.leaveProcessGroup(this);
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

class Thread {
  constructor(executableUrl, process, threadId = getNewTid()) {
    this.state = THREAD_STATE.INIT;
    this.executableUrl = executableUrl;
    this.process = process;
    this.threadId = threadId;
    this.sysBufAddr = 0;
    this.signalInterruptController = null;
    this.terminateWorker = null;
    this.return_value = 0x1234; /* Uint32 */
    this.joinable = true;
    const ofd = new OpenFileDescription();
    this.fdtable = new FileDescriptorTable([new FileDescriptor(ofd, false), new FileDescriptor(ofd, false), new FileDescriptor(ofd, false)]);
    Object.seal(this); // We want the shape of this object to stay the same
    this.process.joinProcess(this);
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

  isLastThreadInProcess() {
    // TODO: make this accurate
    return true;
  }

  userMisbehaved(message) {
    console.log("User Misbehaved:", message);
    debugger;
    this.process.kill();
  }

  registerSysBuf(message) {
    if (this.process.memory === null) {
      throw new Error("Messages passed out-of-order along message queue; registerSysBuf arrived before shareModuleAndMemory");
    }
    const memory = this.process.memory;
    const buffer = memory.buffer;
    const sysBufAddr = message.sysBuf;
    // TODO: don't crash the kernel on bad sysBufAddr
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

  // Should only be called in the RUNNING or SYSCALL states
  requestUserExit() {
    Atomics.or(this.flagWord(), 0, OSOAP_SYS.FLAG.EXIT);
  }

  // Set this.return_value separately
  // Detaches the syscall buffer, asks the user program to exit,
  // and cleans up other resources owned by the thread.
  hangup() {
    if (this.state === THREAD_STATE.ZOMBIE || this.state === THREAD_STATE.DETACHED) return;
    this.state = THREAD_STATE.DETACHED;
    if (this.state !== THREAD_STATE.INIT) {
      notifyDetachedState(this.syncWord());
    }
    this.fdtable.tearDown();
    this.fdtable = null;
    if (this.signalInterruptController !== null) {
      this.signalInterruptController.abort();
    }
  }

  terminate_now() {
    // Expects to be called only from process.terminate_now
    if (this.terminateWorker !== null) {
      this.terminateWorker();
      this.terminateWorker = null;
    }
    this.hangup();
    this.state = THREAD_STATE.ZOMBIE;
  }

  onExit() {
    this.terminateWorker = null;
    if (this.state !== THREAD_STATE.DETACHED) {
      this.userMisbehaved("Exit without detaching");
    }
    // TODO: if not joinable, clean up right away
    this.state = THREAD_STATE.ZOMBIE;
    console.log(`Thread exited, return value 0x${this.return_value.toString(16)}`);
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
  const process = new Process({joinProcessGroup() {}});
  const thread = new Thread(executableUrl, process, process.processid);
  thread.terminateWorker = startWorker(thread);
};

export {spawnProcess};
