import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {SIG_MASK_BYTES} from '../../constants/signal.js';
import {E} from './errno.js';
import {SyscallError} from './SyscallError.js';

const SIGSET_SIZE = SIG_MASK_BYTES; // bytes

const SIG_BLOCK = 0;
const SIG_UNBLOCK = 1;
const SIG_SETMASK = 2;

const sigprocmask = (dv, thread) => {
  const how = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const set = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const oldset = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const sigsetsize = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 3, true);
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
    dv.setBigUint64(oldset, thread.signalMask, true);
  }
  if (set !== 0) {
    const sigset = dv.getBigUint64(set, true);
    if (how === SIG_BLOCK) {
      thread.signalMask |= sigset;
    } else if (how === SIG_UNBLOCK) {
      thread.signalMask &= ~sigset;
    } else if (how === SIG_SETMASK) {
      thread.signalMask = sigset;
    } else {
      throw new SyscallError(E.INVAL);
      // Bad how value
    }
  }
  return 0;
};

export {sigprocmask};
