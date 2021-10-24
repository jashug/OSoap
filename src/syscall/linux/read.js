import {getFd, getPtr, getInt32, getUint32} from '../SyscallBuffer.js';
import {parseIOVec} from './parseIOVec.js';

const doRead = (thread, fd, data, totalLen) => {
  if (totalLen === 0) return 0;
  return thread.process.fdtable.get(fd).openFileDescription.readv(data, thread, totalLen);
};

const readv = (sysbuf, thread) => {
  const fd = getFd(sysbuf.linuxSyscallArg(0));
  const iov = getPtr(sysbuf.linuxSyscallArg(1));
  const iovcnt = getInt32(sysbuf.linuxSyscallArg(2));
  const {data, totalLen} = parseIOVec(sysbuf.dv, iov, iovcnt);
  return doRead(thread, fd, data, totalLen);
};

const read = (sysbuf, thread) => {
  const fd = getFd(sysbuf.linuxSyscallArg(0));
  const buf = getPtr(sysbuf.linuxSyscallArg(1));
  const count = getUint32(sysbuf.linuxSyscallArg(2));
  const data = [sysbuf.subUint8Array(buf, count)];
  return doRead(thread, fd, data, count);
};

export {read, readv};
