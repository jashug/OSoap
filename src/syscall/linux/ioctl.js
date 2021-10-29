const ioctl = (sysbuf, thread) => {
  const fd = sysbuf.linuxSyscallArg(0).getFd();
  const request = sysbuf.linuxSyscallArg(1).getUint32();
  const argp = sysbuf.linuxSyscallArg(2).getPtr();
  return thread.process.fdtable.get(fd).openFileDescription.ioctl(request, argp, sysbuf.dv, thread);
};

export {ioctl};
