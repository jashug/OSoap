import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {SyscallError} from './SyscallError.js';
import {E} from './errno.js';

// TODO: make pids 64 bits, probably requires moving this to an osoap syscall

const getpgid = (dv, thread) => {
  const pid = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  if (pid !== 0) {
    debugger;
    thread.requestUserDebugger();
    throw new SyscallError(E.SRCH);
  } else {
    const pgid = thread.process.processGroup.processGroupId;
    return pgid;
  }
};

const setpgid = (dv, thread) => {
  const pid = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const pgid = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  debugger;
  thread.requestUserDebugger();
  throw new SyscallError(E.INVAL);
};

export {getpgid, setpgid};
