import {SYSBUF_OFFSET, OSOAP_SYS} from '../../constants/syscallBufferLayout.js';
import {SYS} from './syscall.js';
import {E} from './errno.js';
import {SyscallError} from './SyscallError.js';

import {ioctl} from './ioctl.js';
import {readv} from './readv.js';
import {writev} from './writev.js';
import {sigprocmask} from './sigprocmask.js';
import {sigaction} from './sigaction.js';
import {statx} from './statx.js';
import {clock_gettime} from './clock.js';
import {access} from './access.js';
import {open} from './open.js';

const defaultSyscall = (syscallNumber) => (dv, thread) => {
  console.log(`Unimplemented syscall ${syscallNumber}`);
  debugger;
  thread.requestUserDebugger();
  throw new SyscallError(E.NOSYS);
};

const deprecatedSyscall = (syscallNum, suggestedAlternate) => {
  return [syscallNum, (dv, thread) => {
    console.log(`Use of deprecated syscall number ${syscallNum}: instead ${suggestedAlternate}`);
    thread.requestUserDebugger();
    throw new SyscallError(E.NOSYS);
  }];
};

const linuxSyscallTable = new Map([
  [SYS.ioctl, ioctl],
  [SYS.readv, readv],
  [SYS.writev, writev],
  [SYS.rt_sigprocmask, sigprocmask],
  [SYS.rt_sigaction, sigaction],
  [SYS.statx, statx],
  [SYS.clock_gettime, clock_gettime],
  [SYS.access, access],
  [SYS.open, open],
  deprecatedSyscall(SYS.fork, "use OSoap syscall fork"),
  deprecatedSyscall(SYS.exit, "use OSoap syscall exit"),
  deprecatedSyscall(SYS.gettid, "use OSoap syscall gettid"),
]);

const dispatchLinuxSyscall = (syscallNumber) => {
  return linuxSyscallTable.get(syscallNumber) ?? defaultSyscall(syscallNumber);
};

const tryLinuxSyscall = async (syscall, dv, thread) => {
  try {
    return await syscall(dv, thread);
  } catch (e) {
    if (e.linuxSyscallErrno !== undefined) {
      return -e.linuxSyscallErrno;
    } else if (e instanceof RangeError) {
      return -E.FAULT;
    } else {
      throw e;
    }
  }
};

const linuxSyscall = async (dv, thread) => {
  const syscall_number = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.n, true);
  const syscall = dispatchLinuxSyscall(syscall_number);
  const syscall_return = await tryLinuxSyscall(syscall, dv, thread);
  dv.setInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall_return, syscall_return, true);
  dv.setUint32(thread.sysBufAddr + SYSBUF_OFFSET.tag, OSOAP_SYS.TAG.R.linux_syscall_return, true);
};

export {linuxSyscall};
