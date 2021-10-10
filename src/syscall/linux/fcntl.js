import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {InvalidError} from './InvalidError.js';

const F = {
  DUPFD: 0,
  GETFD: 1,
  SETFD: 2,
  GETFL: 3,
  SETFL: 4,
};

const FD_CLOEXEC = 1;

const fcntl = (dv, thread) => {
  const fdNum = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const cmd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const fd = thread.process.fdtable.get(fdNum);
  if (cmd === F.GETFD) {
    let ret = 0;
    if (fd.closeOnExec) ret |= FD_CLOEXEC;
    return ret;
  } else if (cmd === F.SETFD) {
    const arg = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
    fd.closeOnExec = Boolean(arg & FD_CLOEXEC);
    return 0;
  } else if (cmd === F.GETFL) {
    return fd.openFileDescription.statusFlags | fd.openFileDescription.accessMode;
  } else {
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }
};

export {fcntl};
