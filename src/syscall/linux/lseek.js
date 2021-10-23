import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {InvalidError} from './InvalidError.js';

const lseek = (dv, thread) => {
  const fd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const offset = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true); // off_t is 64 bits
  const whence = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  void fd, offset, whence;
  debugger;
  thread.requestUserDebugger();
  throw new InvalidError();
};

export {lseek};
