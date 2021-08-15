import {startWorker} from './manageWorkers.js';
import {UserError} from './UserError.js';

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

const __OSOAP_SYS_TURN_USER = 0;
//const __OSOAP_SYS_TURN_KERNEL = 1;
const __OSOAP_SYS_FLAG_DEBUGGER = 0x2;

const waitAsyncPromise = (array, addr, value) => {
  return Promise.resolve(Atomics.waitAsync(array, addr, value).value);
  // More complicated, perhaps faster version?
  /*
  const {async: isAsync, value: result} = Atomics.waitAsync(array, addr, value);
  if (isAsync) return result;
  else return Promise.resolve(result);
  */
};

class Process {
  constructor(executableUrl) {
    this.executableUrl = executableUrl;
    this.tid = getNewTid();
    this.compiledModule = null;
    this.memory = null;
    this.sysBufAddr = 0;
    this.sysBufClock = 0;
    this.terminateWorker = null;
    Object.seal(this); // We want the shape of this object to stay the same
  }

  syncWord() {
    return new Int32Array(this.memory.buffer, this.sysBufAddr, 1);
  }

  flagWord() {
    return new Uint32Array(this.memory.buffer, this.sysBufAddr + 4, 1);
  }

  listenForSyscall(sync) {
    const clock = this.sysBufClock;
    // int32array == new Int32Array(this.memory.buffer)
    waitAsyncPromise(sync, 0, __OSOAP_SYS_TURN_USER)
      .then((wake_cause) => {
        void wake_cause; // Either "ok" or "not-equal", but we don't care
        if (this.sysBufClock !== clock || this.memory === null) return;
        this.respondToSyscall();
        if (this.memory === null) return;
        const sync = this.syncWord();
        Atomics.store(sync, 0, __OSOAP_SYS_TURN_USER);
        Atomics.notify(sync, 0, 1);
        this.listenForSyscall(sync);
      });
  }

  respondToSyscall() {
    this.requestUserDebugger();
    debugger;
  }

  requestUserDebugger() {
    Atomics.or(this.flagWord(), 0, __OSOAP_SYS_FLAG_DEBUGGER);
  }

  // Should only be called during the processing of a syscall
  detachSysBuf() {
    this.memory = null;
  }

  detachAndCleanUpAsyncWait() {
    // Well-behaved programs should never force this to be called.
    if (this.memory !== null) {
      const syncWord = this.syncWord();
      this.detachSysBuf();
      Atomics.notify(syncWord, 0);
    }
  }

  abort() {
    if (this.terminateWorker !== null) {
      this.terminateWorker();
      this.terminateWorker = null;
    }
    this.detachAndCleanUpAsyncWait();
    // TODO: Communicate that the process has ended
  }

  onExit(exitCode) {
    console.log(`Exited with code: ${exitCode}`);
  }

  onError(e) {
    throw new UserError(`Worker Error: ${e}`);
  }

  registerSysBuf(message) {
    if (this.memory !== null) throw new UserError("Double register sysBuf");
    const memory = message.memory;
    const buffer = memory.buffer;
    const sysBufAddr = message.sysBuf;
    if (sysBufAddr & 3) throw new UserError("sysBuf is not 4 byte aligned");
    if (sysBufAddr < 0 || sysBufAddr >= buffer.byteLength) {
      throw new UserError("sysBuf out of range");
    }
    this.compiledModule = message.compiledModule;
    this.sysBufClock += 1;
    this.memory = memory;
    this.sysBufAddr = sysBufAddr;
    this.listenForSyscall(this.syncWord());
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
