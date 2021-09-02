import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';

const writev = (dv, thread) => {
  const fd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const iov = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const iovcnt = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  // TODO: error handling
  // TODO: filesystem
  const data = [];
  for (let i = 0; i < iovcnt; i++) {
    const iov_base = dv.getUint32(iov + i * 8, true);
    const iov_len = dv.getUint32(iov + i * 8 + 4, true);
    data.push(new Uint8Array(dv.buffer, iov_base, iov_len));
  }
  return thread.process.fdtable.get(fd).openFileDescription.writev(data);
};

export {writev};
