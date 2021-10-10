import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {InvalidError} from './InvalidError.js';

const RLIM = {
  NPROC: 6,
};

const writeRLimit = (dv, buf, {cur, max}) => {
  dv.setBigUint64(buf, cur, true);
  dv.setBigUint64(buf + 8, max, true);
};

const prlimit = (dv, thread) => {
  const pid = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const resource = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const newbuf = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const oldbuf = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 3, true);
  if (pid !== 0) {
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }
  if (newbuf !== 0) {
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }
  if (resource === RLIM.NPROC) {
    writeRLimit(dv, oldbuf, {cur: 1n << 31n, max: 1n << 31n});
  } else {
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }
  return 0;
};

export {prlimit};
