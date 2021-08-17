import {SYSBUF_OFFSET, OSOAP_SYS} from '../constants/syscallBufferLayout.js';

import {linuxSyscall} from './linux/dispatch.js';
import {detach} from './detach.js';

const defaultSyscall = (dv, process) => {
  debugger;
  process.requestUserDebugger();
  dv.setUint32(process.sysBufAddr + SYSBUF_OFFSET.tag, OSOAP_SYS.TAG.R.unknown_syscall, true);
};

const syscallTable = new Map([
  [OSOAP_SYS.TAG.W.linux_syscall, linuxSyscall],
  [OSOAP_SYS.TAG.W.detach, detach],
]);

const dispatchSyscall = (syscall_tag) => {
  const syscall = syscallTable.get(syscall_tag);
  if (syscall === undefined) return defaultSyscall;
  else return syscall;
};

export {dispatchSyscall};
