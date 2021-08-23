import {SYSBUF_OFFSET, OSOAP_SYS} from '../../constants/syscallBufferLayout.js';
import {SYS} from './syscall.js';
import {E} from './errno.js';
import {SyscallError} from './SyscallError.js';

import {ioctl} from './ioctl.js';
import {writev} from './writev.js';

const defaultSyscall = (dv, process) => {
  debugger;
  process.requestUserDebugger();
  throw new SyscallError(E.NOSYS);
};

const linuxSyscallTable = new Map([
  [SYS.ioctl, ioctl],
  [SYS.writev, writev],
]);

const dispatchLinuxSyscall = (syscall_number) => {
  const syscall = linuxSyscallTable.get(syscall_number);
  if (syscall === undefined) return defaultSyscall;
  else return syscall;
};

const tryLinuxSyscall = (syscall, dv, process) => {
  try {
    return syscall(dv, process);
  } catch (e) {
    if (e.linuxSyscallErrno !== undefined) {
      return -e.linuxSyscallErrno;
    } else {
      throw e;
    }
  }
};

const linuxSyscall = (dv, process) => {
  const syscall_number = dv.getInt32(process.sysBufAddr + SYSBUF_OFFSET.linux_syscall.n, true);
  const syscall = dispatchLinuxSyscall(syscall_number);
  const syscall_return = tryLinuxSyscall(syscall, dv, process);
  dv.setInt32(process.sysBufAddr + SYSBUF_OFFSET.linux_syscall_return, syscall_return, true);
  dv.setUint32(process.sysBufAddr + SYSBUF_OFFSET.tag, OSOAP_SYS.TAG.R.linux_syscall_return, true);
};

export {linuxSyscall};
