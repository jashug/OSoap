import {SYSBUF_OFFSET, OSOAP_SYS} from '../constants/syscallBufferLayout.js';

import {linuxSyscall} from './linux/dispatch.js';
import {exit_process} from './exit_process.js';
import {exit_thread} from './exit_thread.js';

const defaultSyscall = (dv, process) => {
  debugger;
  process.requestUserDebugger();
  dv.setUint32(process.sysBufAddr + SYSBUF_OFFSET.tag, OSOAP_SYS.TAG.R.unknown_syscall, true);
};

const SYS_NUM = OSOAP_SYS.TAG.W;

const syscallTable = new Map([
  [SYS_NUM.linux_syscall, linuxSyscall],
  [SYS_NUM.exit_process, exit_process],
  [SYS_NUM.exit_thread, exit_thread],
]);

const dispatchSyscall = (syscall_tag) => {
  const syscall = syscallTable.get(syscall_tag);
  if (syscall === undefined) return defaultSyscall;
  else return syscall;
};

export {dispatchSyscall};
