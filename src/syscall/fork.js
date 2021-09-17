import {SYSBUF_OFFSET, OSOAP_SYS} from '../constants/syscallBufferLayout.js';
import {E} from './linux/errno.js';

// TODO: make pid_t 64 bits

const fork = (dv, thread) => {
  // Pretend we are the parent
  dv.setUint32(thread.sysBufAddr + SYSBUF_OFFSET.tag, OSOAP_SYS.TAG.R.pid_return);
  dv.setUint32(thread.sysBufAddr + SYSBUF_OFFSET.pid_return, thread.process.processId);
};

export {fork};
