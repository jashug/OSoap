import {startWorker} from './manageWorkers.js';
import {UserError} from './UserError.js';
import {SYSBUF_OFFSET, OSOAP_SYS} from './constants/syscallBufferLayout.js';
import {SIG} from './constants/signal.js';
import {dispatchSyscall} from './syscall/dispatch.js';

const POW_2_32 = Math.pow(2, 32);
let tidCounter = 1; // Start PIDs at 1

const getNewTid = () => {
  const oldTid = tidCounter;
  if (oldTid >= POW_2_32) {
    throw new Error("32-bit tids exhausted - move to 64 bits");
  }
  tidCounter += 1;
  return oldTid;
};

const PSTATE = {
  INIT: 'init',
  RUNNING: 'running',
  SYSCALL: 'syscall',
  DETACHED: 'detached',
  ZOMBIE: 'zombie',
};

class Process {
  constructor(executableUrl) {
    this.state = PSTATE.INIT;
    this.executableUrl = executableUrl;
    this.tid = getNewTid();
    this.compiledModule = null;
    this.memory = null;
    this.sysBufAddr = 0;
    this.signalInterruptController = null;
    this.terminateWorker = null;
    this.wstatus = 0x1234; // Valid in DETACHED and ZOMBIE states
    Object.seal(this); // We want the shape of this object to stay the same
  }

  syncWord() {
    return new Int32Array(
      this.memory.buffer,
      this.sysBufAddr + SYSBUF_OFFSET.sync_word,
      1,
    );
  }

  flagWord() {
    return new Uint32Array(
      this.memory.buffer,
      this.sysBufAddr + SYSBUF_OFFSET.flag_word,
      1,
    );
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
      if (this.state !== PSTATE.RUNNING) break;
      this.state = PSTATE.SYSCALL;
      await this.respondToSyscall();
      if (this.state !== PSTATE.SYSCALL) break;
      sync = this.syncWord();
      this.syscallReturnToUser(sync);
      this.state = PSTATE.RUNNING;
    }
  }

  syscallReturnToUser(sync) {
    Atomics.store(sync, 0, OSOAP_SYS.TURN.USER);
    Atomics.notify(sync, 0, 1);
  }

  respondToSyscall() {
    const dv = new DataView(this.memory.buffer);
    const syscall_tag = dv.getUint32(this.sysBufAddr + SYSBUF_OFFSET.tag, true);
    return dispatchSyscall(syscall_tag)(dv, this);
  }

  // Call in the RUNNING or SYSCALL states
  requestUserDebugger() {
    Atomics.or(this.flagWord(), 0, OSOAP_SYS.FLAG.DEBUGGER);
  }

  requestUserDie() {
    Atomics.or(this.flagWord(), 0, OSOAP_SYS.FLAG.DIE);
  }

  detachSysBuf(wstatus) {
    if (this.state === PSTATE.ZOMBIE || this.state === PSTATE.DETACHED) return;
    if (this.state === PSTATE.RUNNING || this.state === PSTATE.SYSCALL) {
      this.requestUserDie();
    }
    if (this.state === PSTATE.SYSCALL) {
      this.syscallReturnToUser(this.syncWord());
    } else if (this.state === PSTATE.RUNNING) {
      // Flush the waitAsync call
      Atomics.notify(this.syncWord(), 0);
    }
    this.wstatus = wstatus;
    this.state = PSTATE.DETACHED;
    this.memory = null;
    this.compiledModule = null;
    if (this.signalInterruptController !== null) {
      this.signalInterruptController.abort();
    }
  }

  abort() {
    if (this.state === PSTATE.ZOMBIE) return;
    if (this.terminateWorker === null) {
      throw Error("Should always have worker outside 'zombie' state");
    }
    this.terminateWorker();
    this.terminateWorker = null;
    this.detachSysBuf(SIG.KILL);
    this.state = PSTATE.ZOMBIE;
  }

  onExit() {
    this.terminateWorker = null;
    if (this.state !== PSTATE.DETACHED) this.detachSysBuf(SIG.ILL);
    this.state = PSTATE.ZOMBIE;
    console.log(`Exited, exit status ${this.wstatus.toString(16)}`);
  }

  onError(e) {
    this.terminateWorker = null;
    this.detachSysBuf(SIG.ILL);
    this.state = PSTATE.ZOMBIE;
    throw new UserError(`Worker Error: ${e}`);
  }

  registerSysBuf(message) {
    if (this.state !== PSTATE.INIT) throw new UserError("Double register sysBuf");
    const memory = message.memory;
    const buffer = memory.buffer;
    const sysBufAddr = message.sysBuf;
    if (sysBufAddr & 3) throw new UserError("sysBuf is not 4 byte aligned");
    if (sysBufAddr < 0 || sysBufAddr >= buffer.byteLength) {
      throw new UserError("sysBuf out of range");
    }
    this.state = PSTATE.RUNNING;
    this.compiledModule = message.compiledModule;
    this.memory = memory;
    this.sysBufAddr = sysBufAddr;
    this.listenForSyscall();
  }
}

//const processTable = new Map();

const spawnProcess = (executableUrl) => {
  const process = new Process(executableUrl);
  // TODO: currently, processes are never removed from the process table.
  // Make a plan for the lifetime of entries here.
  //processTable.set(process.tid, process);
  process.terminateWorker = startWorker(process);
};

export {spawnProcess};
