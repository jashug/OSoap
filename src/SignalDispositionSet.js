import {SIG_DFL, SIG_CANT_BE_CAUGHT, NSIG} from './constants/signal.js';
import {E} from './syscall/linux/errno.js';

class InvalidSignalNumberError extends Error {
  constructor(...args) {
    super(...args);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidSignalNumberError);
    }
    this.name = "InvalidSignalNumberError";
    this.linuxSyscallErrno = E.INVAL;
  }
}

class SignalDispositionSet {
  constructor(copyFrom = new Map()) {
    // Map<signum, immutable {handler: void *, flags: uint32, mask: BigUint64}>
    this.map = new Map(copyFrom);
  }

  get(signalNumber) {
    return this.map.get(signalNumber) ?? {handler: SIG_DFL, flags: 0, mask: 0n};
  }

  set(signalNumber, signalAction) {
    if (signalNumber < 0 || signalNumber >= NSIG || SIG_CANT_BE_CAUGHT.has(signalNumber)) {
      throw new InvalidSignalNumberError();
    }
    this.map.set(signalNumber, signalAction);
  }
}

export {SignalDispositionSet, InvalidSignalNumberError};
