import {getFd} from '../SyscallBuffer.js';

const dup = (sysbuf, thread) => {
  const oldfd = getFd(sysbuf.linuxSyscallArg(0));
  return thread.process.fdtable.dup(oldfd);
};

const dup2 = (sysbuf, thread) => {
  const oldfd = getFd(sysbuf.linuxSyscallArg(0));
  const newfd = getFd(sysbuf.linuxSyscallArg(1));
  return thread.process.fdtable.dup2(oldfd, newfd);
};

export {dup, dup2};
