const dup = (sysbuf, thread) => {
  const oldfd = sysbuf.linuxSyscallArg(0).getFd();
  return thread.process.fdtable.dup(oldfd);
};

const dup2 = (sysbuf, thread) => {
  const oldfd = sysbuf.linuxSyscallArg(0).getFd();
  const newfd = sysbuf.linuxSyscallArg(1).getFd();
  return thread.process.fdtable.dup2(oldfd, newfd);
};

export {dup, dup2};
