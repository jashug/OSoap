import {SYSBUF_OFFSET} from '../constants/syscallBufferLayout.js';

const exit_thread = (dv, thread) => {
  thread.exit(
    dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.exit_thread_return_value, true)
  );
};

export {exit_thread};
