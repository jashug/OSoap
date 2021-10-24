import {getInt32, getUint32, getPtr} from '../SyscallBuffer.js';
import {SIGACTION_OFFSET, NSIG, SIG_MASK_BYTES, SIG_CANT_BE_CAUGHT} from '../../constants/signal.js';
import {E} from './errno.js';
import {SyscallError} from './SyscallError.js';

const sigaction = (sysbuf, thread) => {
  const signalNumber = getInt32(sysbuf.linuxSyscallArg(0));
  if (signalNumber < 1 || signalNumber >= NSIG || SIG_CANT_BE_CAUGHT.has(signalNumber)) {
    throw new SyscallError(E.INVAL);
  }
  const newLoc = getPtr(sysbuf.linuxSyscallArg(1));
  const oldLoc = getPtr(sysbuf.linuxSyscallArg(2));
  const sigsetsize = getUint32(sysbuf.linuxSyscallArg(3));
  if (sigsetsize !== SIG_MASK_BYTES) {
    throw new SyscallError(E.INVAL);
  }
  const dv = sysbuf.dv;
  if (oldLoc !== 0) {
    const oldAction = thread.process.signalDisposition.get(signalNumber);
    // copy into oldLoc
    dv.setUint32(oldLoc + SIGACTION_OFFSET.handler, oldAction.handler, true);
    dv.setUint32(oldLoc + SIGACTION_OFFSET.flags, oldAction.flags, true);
    dv.setBigUint64(oldLoc + SIGACTION_OFFSET.mask, oldAction.mask, true);
  }
  if (newLoc !== 0) {
    // copy from newLoc
    const handler = dv.getUint32(newLoc + SIGACTION_OFFSET.handler, true);
    const flags = dv.getUint32(newLoc + SIGACTION_OFFSET.flags, true);
    const mask = dv.getBigUint64(newLoc + SIGACTION_OFFSET.mask, true);
    thread.process.signalDisposition.set(signalNumber, {handler, flags, mask});
  }
  return 0;
};

export {sigaction};
