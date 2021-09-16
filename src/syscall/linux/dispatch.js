import {SYSBUF_OFFSET, OSOAP_SYS} from '../../constants/syscallBufferLayout.js';
import {SYS} from './syscall.js';
import {E} from './errno.js';
import {SyscallError} from './SyscallError.js';

import {ioctl} from './ioctl.js';
import {writev} from './writev.js';
import {sigprocmask} from './sigprocmask.js';
import {fork} from './fork.js';

const defaultSyscall = (dv, thread) => {
  debugger;
  thread.requestUserDebugger();
  throw new SyscallError(E.NOSYS);
};

const linuxSyscallTable = new Map([
  [SYS.ioctl, ioctl],
  [SYS.writev, writev],
  [SYS.rt_sigprocmask, sigprocmask],
  [SYS.fork, fork],
]);

const dispatchLinuxSyscall = (syscall_number) => {
  const syscall = linuxSyscallTable.get(syscall_number);
  if (syscall === undefined) return defaultSyscall;
  else return syscall;
};

const tryLinuxSyscall = (syscall, dv, thread) => {
  try {
    return syscall(dv, thread);
  } catch (e) {
    if (e.linuxSyscallErrno !== undefined) {
      return -e.linuxSyscallErrno;
    } else {
      throw e;
    }
  }
};

const linuxSyscall = (dv, thread) => {
  const syscall_number = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.n, true);
  const syscall = dispatchLinuxSyscall(syscall_number);
  const syscall_return = tryLinuxSyscall(syscall, dv, thread);
  dv.setInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall_return, syscall_return, true);
  dv.setUint32(thread.sysBufAddr + SYSBUF_OFFSET.tag, OSOAP_SYS.TAG.R.linux_syscall_return, true);
};

export {linuxSyscall};
