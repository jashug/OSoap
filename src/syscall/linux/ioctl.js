import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';

const ioctl = (dv, thread) => {
  const fd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const request = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const argp = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  return thread.process.fdtable.get(fd).openFileDescription.ioctl(request, argp, dv, thread);
};

export {ioctl};
