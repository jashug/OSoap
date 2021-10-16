import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {InvalidError} from './InvalidError.js';

// TODO: make pids 64 bits

const W = {
  NOHANG: 1,
  UNTRACED: 2,
  CONTINUED: 8,
  STOPPED: 2,
  EXITED: 4,
  NOWAIT: 0x1000000,
}

const wait4 = (dv, thread) => {
  const pid = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const wstatusPtr = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const options = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const rusagePtr = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 3, true);
  if (rusagePtr !== 0) {
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }
  debugger;
  thread.requestUserDebugger();
  throw new InvalidError();
};

export {wait4};
