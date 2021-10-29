const close = (sysbuf, thread) => {
  const fd = sysbuf.linuxSyscallArg(0).getFd();
  thread.process.fdtable.close(fd);
  return 0;
};

export {close};
