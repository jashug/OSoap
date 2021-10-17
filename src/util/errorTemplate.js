const makeErrorWithErrno = (name, errno) => {
  const MyError = class extends Error {
    constructor(...args) {
      super(...args);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, MyError);
      }
      this.name = name;
      this.linuxSyscallErrno = errno;
    }
  };
  return MyError;
};

export {makeErrorWithErrno};
