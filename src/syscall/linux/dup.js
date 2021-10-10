import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';

const dup = (dv, thread) => {
  const oldfd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  return thread.process.fdtable.dup(oldfd);
};

const dup2 = (dv, thread) => {
  const oldfd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const newfd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  return thread.process.fdtable.dup2(oldfd, newfd);
};

export {dup, dup2};
