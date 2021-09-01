import {SYSBUF_OFFSET} from '../constants/syscallBufferLayout.js';

const exit_process = (dv, thread) => {
  thread.process.exit(
    dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.exit_process_code, true),
  );
};

export {exit_process};
