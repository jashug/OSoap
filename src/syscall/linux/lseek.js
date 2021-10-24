import {getFd, getInt32, getInt64} from '../SyscallBuffer.js';
import {InvalidError} from './InvalidError.js';

const lseek = (sysbuf, thread) => {
  const fd = getFd(sysbuf.linuxSyscallArg(0));
  const offset = getInt64(sysbuf.linuxSyscallArg(1));
  const whence = getInt32(sysbuf.linuxSyscallArg(2));
  void fd, offset, whence;
  debugger;
  thread.requestUserDebugger();
  throw new InvalidError();
};

export {lseek};
