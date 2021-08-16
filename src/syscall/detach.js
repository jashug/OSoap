import {SYSBUF_OFFSET} from '../syscallBufferLayout.js';

const detach = (dv, process) => {
  const exitCode = dv.getInt32(process.sysBufAddr + SYSBUF_OFFSET.detach_exit_code, true) & 0xff;
  process.detachSysBuf(exitCode << 8);
};

export {detach};
