import {SYSBUF_OFFSET} from '../constants/syscallBufferLayout.js';

const exit_thread = (dv, thread) => {
  thread.return_value =
    dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.detach_exit_code, true);
  if (thread.isLastThreadInProcess()) {
    thread.requestUserExit();
  } else {
    thread.hangup();
  }
};

export {exit_thread};
