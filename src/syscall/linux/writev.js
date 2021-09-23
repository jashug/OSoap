import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {parseIOVec} from './parseIOVec.js';

const writev = (dv, thread) => {
  const fd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const iov = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const iovcnt = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const data = parseIOVec(dv, iov, iovcnt);
  return thread.process.fdtable.get(fd).openFileDescription.writev(data);
};

export {writev};
