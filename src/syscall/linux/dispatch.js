import {SYSBUF_OFFSET, OSOAP_SYS} from '../../constants/syscallBufferLayout.js';
import {SYS} from './syscall.js';
import {E} from './errno.js';
import {SyscallError} from './SyscallError.js';

import {ioctl} from './ioctl.js';
import {read, readv} from './read.js';
import {write, writev} from './write.js';
import {sigprocmask} from './sigprocmask.js';
import {sigaction} from './sigaction.js';
import {statx} from './statx.js';
import {clock_gettime} from './clock.js';
import {access, faccessat2} from './access.js';
import {open} from './open.js';
import {close} from './close.js';
import {select, pselect} from './select.js';
import {nanosleep} from './sleep.js';
import {readlink} from './readlink.js';
import {getuid, geteuid, getgid, getegid} from './getuid.js';
import {uname} from './uname.js';
import {getpgid, setpgid} from './getpgid.js';
import {prlimit} from './prlimit.js';
import {fcntl} from './fcntl.js';
import {dup, dup2} from './dup.js';
import {wait4} from './wait.js';
import {execve} from './exec.js';

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
  [SYS.read, read],
  [SYS.write, write],
  [SYS.open, open],
  [SYS.close, close],
  [SYS.rt_sigaction, sigaction],
  [SYS.rt_sigprocmask, sigprocmask],
  [SYS.ioctl, ioctl],
  [SYS.readv, readv],
  [SYS.writev, writev],
  [SYS.access, access],
  [SYS.select, select],
  [SYS.dup, dup],
  [SYS.dup2, dup2],
  [SYS.nanosleep, nanosleep],
  deprecatedSyscall(SYS.getpid, "use OSoap syscall getpid"),
  deprecatedSyscall(SYS.fork, "use OSoap syscall fork"),
  [SYS.execve, execve],
  deprecatedSyscall(SYS.exit, "use OSoap syscall exit"),
  [SYS.wait4, wait4],
  [SYS.uname, uname],
  [SYS.fcntl, fcntl],
  [SYS.readlink, readlink],
  [SYS.getuid, getuid],
  [SYS.getgid, getgid],
  [SYS.geteuid, geteuid],
  [SYS.getegid, getegid],
  [SYS.setpgid, setpgid],
  deprecatedSyscall(SYS.getppid, "use OSoap syscall getppid"),
  [SYS.getpgid, getpgid],
  deprecatedSyscall(SYS.gettid, "use OSoap syscall gettid"),
  [SYS.clock_gettime, clock_gettime],
  [SYS.pselect6, pselect],
  [SYS.prlimit64, prlimit],
  [SYS.statx, statx],
  [SYS.faccessat2, faccessat2],
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
  if (syscall_return === undefined) throw new Error("Linux syscalls should return");
  dv.setInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall_return, syscall_return, true);
  dv.setUint32(thread.sysBufAddr + SYSBUF_OFFSET.tag, OSOAP_SYS.TAG.R.linux_syscall_return, true);
};

export {linuxSyscall};
