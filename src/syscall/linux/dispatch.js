import {OSOAP_SYS} from '../../constants/syscallBufferLayout.js';
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
import {getdents} from './getdents.js';
import {chdir, fchdir, getcwd} from './chdir.js';
import {lseek} from './lseek.js';
import {gettid, getpid, getppid} from './gettid.js';
import {unlinkat, rmdir, unlink} from './unlink.js';
import {renameat} from './rename.js';
import {pipe, pipe2} from './pipe.js';
import {umask} from './umask.js';
import {mkdir, mkdirat} from './mknode.js';

const defaultSyscall = (syscallNumber) => (sysbuf, thread) => {
  console.log(`Unimplemented syscall ${syscallNumber}`);
  debugger;
  thread.requestUserDebugger();
  throw new SyscallError(E.NOSYS);
};

const deprecatedSyscall = (syscallNum, suggestedAlternate) => {
  return [syscallNum, (sysbuf, thread) => {
    console.log(`Use of deprecated syscall number ${syscallNum}: instead ${suggestedAlternate}`);
    thread.requestUserDebugger();
    throw new SyscallError(E.NOSYS);
  }];
};

const nullSyscall = () => {
  throw new SyscallError(E.NOSYS);
};

// Sorted by linux syscall number
const linuxSyscallTable = new Map([
  [SYS.read, read],
  [SYS.write, write],
  [SYS.open, open],
  [SYS.close, close],
  [SYS.lseek, lseek],
  [SYS.rt_sigaction, sigaction],
  [SYS.rt_sigprocmask, sigprocmask],
  [SYS.ioctl, ioctl],
  [SYS.readv, readv],
  [SYS.writev, writev],
  [SYS.access, access],
  [SYS.pipe, pipe],
  [SYS.select, select],
  [SYS.dup, dup],
  [SYS.dup2, dup2],
  [SYS.nanosleep, nanosleep],
  [SYS.getpid, getpid],
  deprecatedSyscall(SYS.fork, "use OSoap syscall fork"),
  [SYS.execve, execve],
  deprecatedSyscall(SYS.exit, "use OSoap syscall exit"),
  [SYS.wait4, wait4],
  [SYS.uname, uname],
  [SYS.fcntl, fcntl],
  [SYS.getcwd, getcwd],
  [SYS.chdir, chdir],
  [SYS.fchdir, fchdir],
  [SYS.mkdir, mkdir],
  [SYS.rmdir, rmdir],
  [SYS.unlink, unlink],
  [SYS.readlink, readlink],
  [SYS.umask, umask],
  [SYS.sysinfo, nullSyscall],
  [SYS.getuid, getuid],
  [SYS.getgid, getgid],
  [SYS.geteuid, geteuid],
  [SYS.getegid, getegid],
  [SYS.setpgid, setpgid],
  [SYS.getppid, getppid],
  [SYS.getpgid, getpgid],
  [SYS.sigaltstack, nullSyscall],
  [SYS.gettid, gettid],
  [SYS.getdents64, getdents],
  [SYS.fadvise64, nullSyscall],
  [SYS.clock_gettime, clock_gettime],
  [SYS.mkdirat, mkdirat],
  [SYS.unlinkat, unlinkat],
  [SYS.renameat, renameat],
  [SYS.pselect6, pselect],
  [SYS.pipe2, pipe2],
  [SYS.prlimit64, prlimit],
  [SYS.copy_file_range, nullSyscall],
  [SYS.statx, statx],
  [SYS.faccessat2, faccessat2],
]);

const dispatchLinuxSyscall = (syscallNumber) => {
  return linuxSyscallTable.get(syscallNumber) ?? defaultSyscall(syscallNumber);
};

const tryLinuxSyscall = async (syscall, sysbuf, thread) => {
  try {
    return await syscall(sysbuf, thread);
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

const linuxSyscall = async (sysbuf, thread) => {
  const syscall_number = sysbuf.linux_syscall_n;
  const syscall = dispatchLinuxSyscall(syscall_number);
  const syscall_return = await tryLinuxSyscall(syscall, sysbuf, thread);
  if (syscall_return === undefined) {
    console.log(`syscall #${syscall_number} returned undefined`);
    debugger;
    throw new Error("Linux syscalls should return");
  }
  sysbuf.linux_syscall_return = syscall_return;
  sysbuf.tag = OSOAP_SYS.TAG.R.linux_syscall_return;
};

export {linuxSyscall};
