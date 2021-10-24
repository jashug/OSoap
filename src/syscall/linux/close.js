import {getFd} from '../SyscallBuffer.js';

const close = (sysbuf, thread) => {
  const fd = getFd(sysbuf.linuxSyscallArg(0));
  thread.process.fdtable.close(fd);
  return 0;
};

export {close};
