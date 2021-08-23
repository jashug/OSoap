class SyscallError extends Error {
  constructor(errno, ...args) {
    super(...args);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SyscallError);
    }
    this.name = "SyscallError";
    this.linuxSyscallErrno = errno;
  }
}

export {SyscallError};
