import {getInt32, getPtr, getUint32} from '../SyscallBuffer.js';
import {SIG_MASK_BYTES} from '../../constants/signal.js';
import {E} from './errno.js';
import {SyscallError} from './SyscallError.js';

const SIGSET_SIZE = SIG_MASK_BYTES; // bytes

const SIG_BLOCK = 0;
const SIG_UNBLOCK = 1;
const SIG_SETMASK = 2;

const sigprocmask = (sysbuf, thread) => {
  const how = getInt32(sysbuf.linuxSyscallArg(0));
  const set = getPtr(sysbuf.linuxSyscallArg(1));
  const oldset = getPtr(sysbuf.linuxSyscallArg(2));
  const sigsetsize = getUint32(sysbuf.linuxSyscallArg(3));
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
    sysbuf.dv.setBigUint64(oldset, thread.signalMask, true);
  }
  if (set !== 0) {
    const sigset = sysbuf.dv.getBigUint64(set, true);
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
