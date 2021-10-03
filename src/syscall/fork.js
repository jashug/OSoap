import {SYSBUF_OFFSET, OSOAP_SYS} from '../constants/syscallBufferLayout.js';
import {getNewTid, Process, Thread} from '../threadTable.js';

// TODO: make pid_t 64 bits

const copyWasmMemory = (memory) => {
  const type = WebAssembly.Memory.type(memory);
  const pages = memory.buffer.byteLength >> 16;
  if (memory.buffer.byteLength !== pages << 16) {
    throw new Error("WebAssembly memory buffer length not page aligned");
  }
  const newMemory = new WebAssembly.Memory({initial: pages, maximum: type.maximum, shared: true});
  const oldArray = new Uint8Array(memory.buffer);
  const newArray = new Uint8Array(newMemory.buffer);
  newArray.set(oldArray); // perform the copy
  return newMemory;
};

const fork = (dv, thread) => {
  const stackBuf = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.fork.stack_buf, true);
  const process = thread.process;

  const sysBufAddr = thread.sysBufAddr;
  const newPid = getNewTid();
  const newModule = process.compiledModule;
  const newMemory = copyWasmMemory(process.memory);
  // Set up the child return
  const newDv = new DataView(newMemory.buffer);
  newDv.setUint32(sysBufAddr + SYSBUF_OFFSET.tag, OSOAP_SYS.TAG.R.pid_return, true);
  newDv.setUint32(sysBufAddr + SYSBUF_OFFSET.pid_return, 0, true);
  newDv.setInt32(sysBufAddr + SYSBUF_OFFSET.sync_word, OSOAP_SYS.TURN.USER, true);

  const newProcess = new Process(
    process.processGroup,
    newPid,
    process.forkProcessData(),
  );
  newProcess.registerModuleAndMemory({
    compiledModule: newModule,
    memory: newMemory,
  });
  const newThread = new Thread(newProcess, newPid, thread.signalMask, {
    /* forking.pid is irrelevant; overwritten by syscall buffer value */
    asyncState: {type: 'childFork', sys_buf: sysBufAddr, stack_buf: stackBuf, pid: 0, retval: 0},
    module: newModule,
    memory: newMemory,
  });
  newThread.registerSysBuf({sysBuf: sysBufAddr});

  // Set up the parent return
  dv.setUint32(sysBufAddr + SYSBUF_OFFSET.tag, OSOAP_SYS.TAG.R.pid_return, true);
  dv.setUint32(sysBufAddr + SYSBUF_OFFSET.pid_return, newPid, true);
};

export {fork};
