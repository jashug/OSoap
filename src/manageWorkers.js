const idleWorkers = [];

// Upper bound on idleWorkers.length
const THREAD_POOL_SIZE = Number.POSITIVE_INFINITY;

const getIdleWorker = () => {
  if (idleWorkers.length > 0) return idleWorkers.pop();
  else return new Worker('src/worker.js', {type: 'module'});
};

const idleWorkerMessage = (e) => {
  // Could happen if C code calls register_sys_buf after throw_exit
  throw new Error(`Worker was supposed to be idle, but recieved ${e}`);
};

/* process describes the process being started.
 * onRegisterSysBuf is called possibly multiple times, at the user program's
 *   discression. Should install a handler to react to messages from the worker
 *   at the indicated location.
 * onExit, onError: at most one of these is called, when the worker exits.
 *   onError may include errors in the compilation and instantiation of the
 *   provided script, as well as WebAssembly traps. Also called if the
 *   user-provided executable fails to call throw_exit.
 * the return value is terminateWorker, which may be called once to force
 *   immediate termination of the worker.
 */
const startWorker = (process) => {
  const worker = getIdleWorker();
  let workerReleased = false;
  const setReleasedFlag = () => {
    if (workerReleased) throw new Error("Double release of worker");
    workerReleased = true;
  };
  const releaseWorker = () => {
    setReleasedFlag();
    worker.onmessage = idleWorkerMessage;
    worker.onerror = idleWorkerMessage;
    if (idleWorkers.length < THREAD_POOL_SIZE) idleWorkers.push(worker);
  };
  const terminateWorker = () => {
    setReleasedFlag();
    worker.terminate();
  };
  worker.postMessage({
    purpose: "start",
    module: process.executableUrl,
    tid: process.tid,
  });
  worker.onmessage = (e) => {
    if (e.data.purpose === 'registerSyscallBuffer') {
      process.registerSysBuf(e.data);
    } else if (e.data.purpose === 'exit') {
      releaseWorker();
      process.onExit(e.data.exitCode);
    } else {
      // No way for user-space programs to send arbitrary messages,
      // so this error is an error in worker.js
      throw new Error(`Unrecognized message purpose ${e.data.purpose}`);
    }
  };
  worker.onerror = (e) => {
    releaseWorker();
    process.onError(e);
  };
  return terminateWorker;
};

export {
  startWorker,
};
