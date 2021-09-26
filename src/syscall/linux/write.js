import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {parseIOVec} from './parseIOVec.js';

const doWrite = (thread, fd, data, totalLen) => {
  if (totalLen === 0) return 0;
  return thread.process.fdtable.get(fd).openFileDescription.writev(data, thread, totalLen);
};

const writev = (dv, thread) => {
  const fd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const iov = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const iovcnt = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const {data, totalLen} = parseIOVec(dv, iov, iovcnt);
  return doWrite(thread, fd, data, totalLen);
};

const write = (dv, thread) => {
  const fd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const buf = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const count = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const data = [new Uint8Array(dv.buffer, buf + dv.byteOffset, count)];
  return doWrite(thread, fd, data, count);
};

export {write, writev};
