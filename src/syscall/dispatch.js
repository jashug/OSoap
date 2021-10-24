import {OSOAP_SYS} from '../constants/syscallBufferLayout.js';

import {linuxSyscall} from './linux/dispatch.js';
import {exit_process} from './exit_process.js';
import {exit_thread} from './exit_thread.js';
import {fork} from './fork.js';

const defaultSyscall = (sysbuf, thread) => {
  debugger;
  thread.requestUserDebugger();
  sysbuf.tag = OSOAP_SYS.TAG.R.unknown_syscall;
};

const SYS_NUM = OSOAP_SYS.TAG.W;

const syscallTable = new Map([
  [SYS_NUM.linux_syscall, linuxSyscall],
  [SYS_NUM.exit_process, exit_process],
  [SYS_NUM.exit_thread, exit_thread],
  [SYS_NUM.fork, fork],
]);

const dispatchSyscall = (syscall_tag) => {
  const syscall = syscallTable.get(syscall_tag);
  if (syscall === undefined) return defaultSyscall;
  else return syscall;
};

export {dispatchSyscall};
