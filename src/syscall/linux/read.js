import {parseIOVec} from './parseIOVec.js';

const doRead = (thread, fd, data, totalLen) => {
  if (totalLen === 0) return 0;
  return thread.process.fdtable.get(fd).openFileDescription.readv(data, thread, totalLen);
};

const readv = (sysbuf, thread) => {
  const fd = sysbuf.linuxSyscallArg(0).getFd();
  const iov = sysbuf.linuxSyscallArg(1).getPtr();
  const iovcnt = sysbuf.linuxSyscallArg(2).getInt32();
  const {data, totalLen} = parseIOVec(sysbuf.dv, iov, iovcnt);
  return doRead(thread, fd, data, totalLen);
};

const read = (sysbuf, thread) => {
  const fd = sysbuf.linuxSyscallArg(0).getFd();
  const buf = sysbuf.linuxSyscallArg(1).getPtr();
  const count = sysbuf.linuxSyscallArg(2).getUint32();
  const data = [sysbuf.subUint8Array(buf, count)];
  return doRead(thread, fd, data, count);
};

export {read, readv};
