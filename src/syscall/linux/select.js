import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {InvalidError} from './InvalidError.js';

const FD_SETSIZE = 1024;
// const FD_SETSIZE_WORDS = FD_SETSIZE / 32;

const getFdSet = (dv, loc, nfds, fdtable) => {
  if (loc === 0) return [];
  const words = [];
  const nwords = ((nfds + 31) >> 5);
  const readend = loc + (nwords << 2);
  for (let i = loc; i < readend; i += 4) {
    words.push(dv.getUint32(i, true));
  }
  const fds = [];
  for (let i = 0; i < nfds; i++) {
    if (words[i >> 5] & (1 << (i & 31))) {
      fds.push({i, fd: fdtable.get(i).openFileDescription});
    }
  }
  return fds;
};

const clearFdSet = (dv, loc, nfds, fds) => {
  const words = [];
  const nwords = ((nfds + 31 >> 5));
  const writeend = loc + (nwords << 2);
  for (let i = 0; i < nwords; i++) {
    words.push(0);
  }
  for (const {i} of fds) {
    words[i >> 5] |= (1 << (i & 31));
  }
  for (let i = writeend - 4; i >= loc; i -= 4) {
    dv.setUint32(i, ~words.pop(), true);
  }
};

const readTimeVal = (dv, loc) => {
  if (loc === 0) return null;
  const sec = dv.getInt32(loc + 0, true);
  const usec = dv.getInt32(loc + 4, true);
  return {sec, usec};
};

const select = (dv, thread) => {
  const nfds = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  if (nfds < 0 || nfds > FD_SETSIZE) throw new InvalidError();
  const readfds = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const writefds = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const exceptfds = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 3, true);
  const timeoutLoc = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 4, true);
  const timeout = readTimeVal(dv, timeoutLoc); // null means infinite
  const readFdSet = getFdSet(dv, readfds, nfds, thread.process.fdtable);
  const writeFdSet = getFdSet(dv, writefds, nfds, thread.process.fdtable);
  const exceptFdSet = getFdSet(dv, exceptfds, nfds, thread.process.fdtable);

  let readyFds = 0;
  // poll fds
  const readToClear = [];
  for (const fd of readFdSet) {
    if (fd.fd.readyForReading() === true) readyFds++;
    else readToClear.push(fd);
  }
  clearFdSet(dv, readfds, nfds, readToClear);
  const writeToClear = [];
  for (const fd of writeFdSet) {
    if (fd.fd.readyForWriting() === true) readyFds++;
    else writeToClear.push(fd);
  }
  clearFdSet(dv, writefds, nfds, writeToClear);
  const exceptionToClear = [];
  for (const fd of exceptFdSet) {
    if (fd.fd.errorConditionPending() === true) readyFds++;
    else exceptionToClear.push(fd);
  }
  clearFdSet(dv, exceptfds, nfds, exceptionToClear);

  if (readyFds === 0 && timeout.sec !== 0 && timeout.usec !== 0) {
    // TODO: block until ready
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  } else {
    return readyFds;
  }
};

export {select};
