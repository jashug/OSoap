import {getFd, getInt32} from '../SyscallBuffer.js';
import {InvalidError} from './InvalidError.js';

const F = {
  DUPFD: 0,
  GETFD: 1,
  SETFD: 2,
  GETFL: 3,
  SETFL: 4,
};

const FD_CLOEXEC = 1;

const fcntl = (sysbuf, thread) => {
  const fdNum = getFd(sysbuf.linuxSyscallArg(0));
  const cmd = getInt32(sysbuf.linuxSyscallArg(1));
  const fd = thread.process.fdtable.get(fdNum);
  if (cmd === F.DUPFD) {
    const arg = getInt32(sysbuf.linuxSyscallArg(2));
    const fdcopy = fd.copy({closeOnExec: false});
    return thread.process.fdtable.allocate(fdcopy, arg);
  } else if (cmd === F.GETFD) {
    let ret = 0;
    if (fd.closeOnExec) ret |= FD_CLOEXEC;
    return ret;
  } else if (cmd === F.SETFD) {
    const arg = getInt32(sysbuf.linuxSyscallArg(2));
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
