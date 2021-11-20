const umask = (sysbuf, thread) => {
  const mask = sysbuf.linuxSyscallArg(0).getMode();
  const process = thread.process;
  const oldUmask = process.fileModeCreationMask;
  process.fileModeCreationMask = mask & 0o777;
  return oldUmask;
};

export {umask};
