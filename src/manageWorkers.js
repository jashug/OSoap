import {once} from './oneAtATimeError.js';
import {UserError} from './UserError.js';

const idleWorkers = [];

const THREAD_POOL_SIZE = Number.POSITIVE_INFINITY;

const getIdleWorker = () => {
  if (idleWorkers.length > 0) return idleWorkers.pop();
  return new Worker('src/worker.js', {type: 'module'});
};

const idleWorkerMessage = (e) => {
  // Could happen if C code calls register_sys_buf after throw_exit
  throw new UserError(`Worker was supposed to be idle, but recieved ${e}`);
};

/* process describes the process being started.
 * onRegisterSysBuf and onError are called at most once,
 * and should react to messages from the worker.
 * the return value is releaseWorker, which should be called at most once
 * when the worker transitions back to idle state.
 * releaseWorker is called automatically before onError.
 */
const startWorker = (process, onRegisterSysBuf, onError) => {
  const worker = getIdleWorker();
  worker.postMessage({
    purpose: "start",
    module: process.executable_url,
    tid: process.tid,
  });
  const register_sys_buf = once(onRegisterSysBuf);
  worker.onmessage = (e) => {
    if (e.data.purpose === 'register_syscall_buffer') {
      register_sys_buf(e.data);
    } else {
      // No way for user-space programs to send arbitrary messages,
      // so this error is an error in worker.js
      throw new Error(`Unrecognized message purpose ${e.data.purpose}`);
    }
  };
  const releaseWorker = () => {
    worker.onmessage = idleWorkerMessage;
    worker.onerror = idleWorkerMessage;
    if (idleWorkers.length < THREAD_POOL_SIZE) idleWorkers.push(worker);
  };
  const releaseWorkerOnce = once(releaseWorker);
  worker.onerror = (e) => {
    releaseWorkerOnce();
    onError(e);
  };
  return {
    releaseWorker: releaseWorkerOnce,
    terminateWorker: () => worker.terminate(),
  };
};

export {
  startWorker,
};
