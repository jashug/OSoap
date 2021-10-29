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
  const fdNum = sysbuf.linuxSyscallArg(0).getFd();
  const cmd = sysbuf.linuxSyscallArg(1).getInt32();
  const fd = thread.process.fdtable.get(fdNum);
  if (cmd === F.DUPFD) {
    const arg = sysbuf.linuxSyscallArg(2).getInt32();
    const fdcopy = fd.copy({closeOnExec: false});
    return thread.process.fdtable.allocate(fdcopy, arg);
  } else if (cmd === F.GETFD) {
    let ret = 0;
    if (fd.closeOnExec) ret |= FD_CLOEXEC;
    return ret;
  } else if (cmd === F.SETFD) {
    const arg = sysbuf.linuxSyscallArg(2).getInt32();
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
