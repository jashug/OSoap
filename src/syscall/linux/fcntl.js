import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {InvalidError} from './InvalidError.js';

const F = {
  DUPFD: 0,
  GETFD: 1,
  SETFD: 2,
  GETFL: 3,
  SETFL: 4,
};

const fcntl = (dv, thread) => {
  const fdNum = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const cmd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const fd = thread.process.fdtable.get(fdNum);
  if (cmd === F.GETFL) {
    return fd.openFileDescriptor.statusFlags | fd.openFileDescription.accessMode;
  } else {
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }
};

export {fcntl};
