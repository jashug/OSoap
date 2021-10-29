import {InvalidError} from './InvalidError.js';
import {TimeVal, TimeSpec} from '../../util/timeouts.js';

const FD_SETSIZE = 1024;
// const FD_SETSIZE_WORDS = FD_SETSIZE / 32;

class FdSet {
  constructor(dv, loc, nfds, fdtable) {
    this.words = [];
    this.loc = loc;
    this.dv = dv;
    this.fds = [];
    if (loc !== 0) {
      const nwords = ((nfds + 31) >> 5);
      const endptr = loc + (nwords << 2);
      for (let i = this.loc; i < endptr; i += 4) {
        this.words.push(dv.getUint32(i, true));
      }
      for (let i = 0; i < nfds; i++) {
        if (this.words[i >> 5] & (1 << (i & 31))) {
          this.fds.push({i, fd: fdtable.get(i).openFileDescription,
            markNotReady: () => this.markNotReady(i),
            markReady: () => this.markReady(i),
            writeBack: () => this.writeBack(),
          });
        }
      }
    }
  }

  [Symbol.iterator]() { return this.fds[Symbol.iterator](); }

  markNotReady(i) {
    this.words[i >> 5] &= ~(1 << (i & 31));
  }

  markReady(i) {
    this.words[i >> 5] |= (1 << (i & 31));
  }

  writeBack() {
    for (let i = 0; i < this.words.length; i++) {
      this.dv.setUint32(this.loc + i * 4, this.words[i], true);
    }
  }
}

const select = (sysbuf, thread) => {
  const nfds = sysbuf.linuxSyscallArg(0).getInt32();
  if (nfds < 0 || nfds > FD_SETSIZE) throw new InvalidError();
  const readfds = sysbuf.linuxSyscallArg(1).getPtr();
  const writefds = sysbuf.linuxSyscallArg(2).getPtr();
  const exceptfds = sysbuf.linuxSyscallArg(3).getPtr();
  const timeoutLoc = sysbuf.linuxSyscallArg(4).getPtr();
  const timeout = TimeVal.read(sysbuf.dv, timeoutLoc);
  return doSelect(sysbuf.dv, thread, nfds, readfds, writefds, exceptfds, timeout);
};

const pselect = async (sysbuf, thread) => {
  const nfds = sysbuf.linuxSyscallArg(0).getInt32();
  if (nfds < 0 || nfds > FD_SETSIZE) throw new InvalidError();
  const readfds = sysbuf.linuxSyscallArg(1).getPtr();
  const writefds = sysbuf.linuxSyscallArg(2).getPtr();
  const exceptfds = sysbuf.linuxSyscallArg(3).getPtr();
  const timeoutLoc = sysbuf.linuxSyscallArg(4).getPtr();
  const sigmask = sysbuf.linuxSyscallArg(5).getPtr();
  const timeout = TimeSpec.read(sysbuf.dv, timeoutLoc);
  if (sigmask === 0) return doSelect(sysbuf.dv, thread, nfds, readfds, writefds, exceptfds, timeout, sigmask);
  const savedSignalMask = thread.signalMask;
  thread.signalMask = sysbuf.dv.getBigUint64(sigmask, true);
  try {
    return await doSelect(sysbuf.dv, thread, nfds, readfds, writefds, exceptfds, timeout);
  } finally {
    thread.signalMask = savedSignalMask;
  }
};

const doSelect = async (dv, thread, nfds, readfds, writefds, exceptfds, timeout) => {
  const readFdSet = new FdSet(dv, readfds, nfds, thread.process.fdtable);
  const writeFdSet = new FdSet(dv, writefds, nfds, thread.process.fdtable);
  const exceptFdSet = new FdSet(dv, exceptfds, nfds, thread.process.fdtable);

  let readyFds = 0;
  const nonReadyPromises = [];
  const mayWait = timeout.nonZero;
  // poll fds
  for (const fd of readFdSet) {
    const ready = fd.fd.readyForReading();
    if (ready === true) readyFds++;
    else {
      fd.markNotReady();
      if (ready !== false) nonReadyPromises.push(ready.then(() => fd));
    }
  }
  readFdSet.writeBack();
  for (const fd of writeFdSet) {
    const ready = fd.fd.readyForWriting();
    if (ready === true) readyFds++;
    else {
      fd.markNotReady();
      if (ready !== false) nonReadyPromises.push(ready.then(() => fd));
    }
  }
  writeFdSet.writeBack();
  for (const fd of exceptFdSet) {
    const ready = fd.fd.errorConditionPending();
    if (ready === true) readyFds++;
    else {
      fd.markNotReady();
      if (ready !== false) nonReadyPromises.push(ready.then(() => fd));
    }
  }
  exceptFdSet.writeBack();

  if (readyFds === 0 && mayWait) {
    // TODO: block until ready
    const msecToWait = timeout.toMSec();
    if (msecToWait < Infinity) nonReadyPromises.push(new Promise((resolve) => setTimeout(() => resolve(null), msecToWait)));
    const result = await Promise.any(nonReadyPromises);
    if (result !== null) {
      result.markReady();
      result.writeBack();
      return 1;
    } else {
      return 0;
    }
  } else {
    return readyFds;
  }
};

export {select, pselect};
