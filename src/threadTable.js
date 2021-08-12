import {startWorker} from './manageWorkers.js';
import {UserError} from './UserError.js';

const POW_2_32 = Math.pow(2, 32);
let tidCounter = 0;

const getNewTid = () => {
  const oldTid = tidCounter;
  if (oldTid >= POW_2_32) {
    throw new Error("32-bit tids exhausted - move to 64 bits");
  }
  tidCounter += 1;
  return oldTid;
};

const processTable = new Map();

const spawnProcess = (executable_url) => {
  const process = {
    executable_url: executable_url,
    tid: getNewTid(),
    compiled_module: null,
    memory: null,
    sys_buf_addr: 0,
  };
  processTable.set(process.tid, process);
  startWorker(process,
    (message) => {
      if (message.sys_buf & 3) throw new UserError("sys_buf is not 4 byte aligned");
      process.compiled_module = message.compiled_module;
      process.memory = message.memory;
      process.sys_buf_addr = message.sys_buf >> 2;
    },
    (e) => {
      throw new UserError(`Worker Error: ${e}`);
    },
  );
};

export {spawnProcess};
