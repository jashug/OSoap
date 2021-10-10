import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
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

const select = (dv, thread) => {
  const nfds = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  if (nfds < 0 || nfds > FD_SETSIZE) throw new InvalidError();
  const readfds = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const writefds = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const exceptfds = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 3, true);
  const timeoutLoc = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 4, true);
  const timeout = TimeVal.read(dv, timeoutLoc);
  return doSelect(dv, thread, nfds, readfds, writefds, exceptfds, timeout);
}

const pselect = async (dv, thread) => {
  const nfds = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  if (nfds < 0 || nfds > FD_SETSIZE) throw new InvalidError();
  const readfds = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const writefds = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const exceptfds = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 3, true);
  const timeoutLoc = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 4, true);
  const sigmask = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 5, true);
  const timeout = TimeSpec.read(dv, timeoutLoc);
  if (sigmask === 0) return doSelect(dv, thread, nfds, readfds, writefds, exceptfds, timeout, sigmask);
  const savedSignalMask = thread.signalMask;
  thread.signalMask = dv.getBigUint64(sigmask, true);
  try {
    return await doSelect(dv, thread, nfds, readfds, writefds, exceptfds, timeout);
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
      nonReadyPromises.push(ready.then(() => fd));
    }
  }
  readFdSet.writeBack();
  for (const fd of writeFdSet) {
    const ready = fd.fd.readyForWriting();
    if (ready === true) readyFds++;
    else {
      fd.markNotReady();
      nonReadyPromises.push(ready.then(() => fd));
    }
  }
  writeFdSet.writeBack();
  for (const fd of exceptFdSet) {
    const ready = fd.fd.errorConditionPending();
    if (ready === true) readyFds++;
    else {
      fd.markNotReady();
      nonReadyPromises.push(ready.then(() => fd));
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
