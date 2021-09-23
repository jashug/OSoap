import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';

const close = (dv, thread) => {
  const fd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall_args + 4 * 0, true);
  thread.process.fdtable.close(fd);
  return 0;
};

export {close};
