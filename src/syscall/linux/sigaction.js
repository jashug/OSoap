import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {SIGACTION_OFFSET, NSIG, SIG_MASK_BYTES, SIG_CANT_BE_CAUGHT} from '../../constants/signal.js';
import {E} from './errno.js';
import {SyscallError} from './SyscallError.js';

const sigaction = (dv, thread) => {
  const signalNumber = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  if (signalNumber < 1 || signalNumber >= NSIG || SIG_CANT_BE_CAUGHT.has(signalNumber)) {
    throw new SyscallError(E.INVAL);
  }
  const newLoc = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const oldLoc = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const sigsetsize = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 3, true);
  if (sigsetsize !== SIG_MASK_BYTES) {
    throw new SyscallError(E.INVAL);
  }
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
