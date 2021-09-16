import {SYSBUF_OFFSET, OSOAP_SYS} from '../constants/syscallBufferLayout.js';

// TODO: make pids 64 bits

const gettid = (dv, thread) => {
  dv.setInt32(thread.sysBufAddr + SYSBUF_OFFSET.pid_return, thread.threadId, true);
  dv.setUint32(thread.sysBufAddr + SYSBUF_OFFSET.tag, OSOAP_SYS.TAG.R.pid_return, true);
}

export {gettid};
