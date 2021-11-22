import {OSOAP_SYS} from '../constants/syscallBufferLayout.js';
import {getNewTid, Process, Thread} from '../threadTable.js';
import {SyscallBuffer} from './SyscallBuffer.js';

// TODO: make pid_t 64 bits

const copyWasmMemory = (memory) => {
  const type = memory.type();
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

const fork = (sysbuf, thread) => {
  const stackBuf = sysbuf.fork_stack_buf;
  const process = thread.process;

  const sysBufAddr = thread.sysBufAddr;
  const newPid = getNewTid();
  const newModule = process.compiledModule;
  const newMemory = copyWasmMemory(process.memory);
  // Set up the child return
  const newSysbuf = new SyscallBuffer(newMemory.buffer, sysBufAddr);
  newSysbuf.tag = OSOAP_SYS.TAG.R.linux_syscall_return;
  newSysbuf.linux_syscall_return = 0n;
  newSysbuf.setSyncWord(OSOAP_SYS.TURN.USER, {yesIKnowThisDoesntNotifyUser: true});

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
    asyncState: {type: 'childFork', sys_buf: sysBufAddr, stack_buf: stackBuf, pid: 0n, retval: 0},
    module: newModule,
    memory: newMemory,
  });
  newThread.registerSysBuf({sysBuf: sysBufAddr});

  // Set up the parent return
  sysbuf.tag = OSOAP_SYS.TAG.R.linux_syscall_return;
  sysbuf.linux_syscall_return = newPid;
};

export {fork};
