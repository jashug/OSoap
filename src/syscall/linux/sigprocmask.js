import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {E} from './errno.js';
import {SyscallError} from './SyscallError.js';

const SIGSET_SIZE = 8; // bytes

const SIG_BLOCK = 0;
const SIG_UNBLOCK = 1;
const SIG_SETMASK = 2;

// TODO EFAULT reporting

const sigprocmask = (dv, thread) => {
  const how = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall_args + 4 * 0, true);
  const set = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall_args + 4 * 1, true);
  const oldset = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall_args + 4 * 2, true);
  const sigsetsize = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall_args + 4 * 3, true);
  if (thread.signalMask.byteLength !== SIGSET_SIZE) {
    throw new Error("Wrong sized signal mask");
  }
  if (sigsetsize !== SIGSET_SIZE) {
    throw new SyscallError(E.INVAL);
    // Wrong sized signal mask
  }
  /*
  if (oldset !== 0 && set !== 0
    && oldset < set + SIGSET_SIZE
    && set < oldset + SIGSET_SIZE) {
    thread.userMisbehaved("oldset and set alias eachother in sigprocmask");
  }
  */
  if (oldset !== 0) {
    dv.setUint32(oldset + 4 * 0, thread.signalMask[0], true);
    dv.setUint32(oldset + 4 * 1, thread.signalMask[1], true);
  }
  if (how === SIG_BLOCK) {
    thread.signalMask[0] |= dv.getUint32(set + 4 * 0, true);
    thread.signalMask[1] |= dv.getUint32(set + 4 * 1, true);
  } else if (how === SIG_UNBLOCK) {
    thread.signalMask[0] &= ~dv.getUint32(set + 4 * 0, true);
    thread.signalMask[1] &= ~dv.getUint32(set + 4 * 1, true);
  } else if (how === SIG_SETMASK) {
    thread.signalMask[0] = dv.getUint32(set + 4 * 0, true);
    thread.signalMask[1] = dv.getUint32(set + 4 * 1, true);
  } else {
    throw new SyscallError(E.INVAL);
    // Bad how value
  }
  return 0;
};

export {sigprocmask};
