import {getFd, getPtr, getInt32, getUint32} from '../SyscallBuffer.js';
import {parseIOVec} from './parseIOVec.js';

const doWrite = (thread, fd, data, totalLen) => {
  if (totalLen === 0) return 0;
  return thread.process.fdtable.get(fd).openFileDescription.writev(data, thread, totalLen);
};

const writev = (sysbuf, thread) => {
  const fd = getFd(sysbuf.linuxSyscallArg(0));
  const iov = getPtr(sysbuf.linuxSyscallArg(1));
  const iovcnt = getInt32(sysbuf.linuxSyscallArg(2));
  const {data, totalLen} = parseIOVec(sysbuf.dv, iov, iovcnt);
  return doWrite(thread, fd, data, totalLen);
};

const write = (sysbuf, thread) => {
  const fd = getFd(sysbuf.linuxSyscallArg(0));
  const buf = getPtr(sysbuf.linuxSyscallArg(1));
  const count = getUint32(sysbuf.linuxSyscallArg(2));
  const data = [sysbuf.subUint8Array(buf, count)];
  return doWrite(thread, fd, data, count);
};

export {write, writev};
