import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {E} from './errno.js';
import {SyscallError} from './SyscallError.js';

const ioctl = (dv, thread) => {
  const fd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const request = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  void fd;
  void request;
  if (request === 0x5413 /* TIOCGWINSZ */) {
    // TODO: supposed to fill in the window size
    // May want to replace with new syscalls.
    // musl uses this for isatty, so handling the return code matters early
    return 0;
  } else {
    debugger;
    thread.requestUserDebugger();
    throw new SyscallError(E.INVAL);
  }
};

export {ioctl};
