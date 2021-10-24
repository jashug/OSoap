import {getPid, getInt32, getPtr} from '../SyscallBuffer.js';
import {InvalidError} from './InvalidError.js';
import {MAX_NUM_FDS} from '../../FileDescriptor.js';

const RLIM = {
  NPROC: 6,
  NOFILE: 7,
};

const writeRLimit = (dv, buf, {cur, max}) => {
  if (buf === 0) return;
  dv.setBigUint64(buf, cur, true);
  dv.setBigUint64(buf + 8, max, true);
};

const prlimit = (sysbuf, thread) => {
  const pid = getPid(sysbuf.linuxSyscallArg(0));
  const resource = getInt32(sysbuf.linuxSyscallArg(1));
  const newbuf = getPtr(sysbuf.linuxSyscallArg(2));
  const oldbuf = getPtr(sysbuf.linuxSyscallArg(3));
  if (pid) {
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
    const lim = 1n << 31n;
    writeRLimit(sysbuf.dv, oldbuf, {cur: lim, max: lim});
  } else if (resource === RLIM.NOFILE) {
    const lim = BigInt(MAX_NUM_FDS);
    writeRLimit(sysbuf.dv, oldbuf, {cur: lim, max: lim});
  } else {
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }
  return 0;
};

export {prlimit};
