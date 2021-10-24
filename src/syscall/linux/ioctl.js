import {getFd, getUint32, getPtr} from '../SyscallBuffer.js';

const ioctl = (sysbuf, thread) => {
  const fd = getFd(sysbuf.linuxSyscallArg(0));
  const request = getUint32(sysbuf.linuxSyscallArg(1));
  const argp = getPtr(sysbuf.linuxSyscallArg(2));
  return thread.process.fdtable.get(fd).openFileDescription.ioctl(request, argp, sysbuf.dv, thread);
};

export {ioctl};
