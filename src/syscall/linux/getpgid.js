import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {SyscallError} from './SyscallError.js';
import {E} from './errno.js';
import {InvalidError} from './InvalidError.js';
import {AccessError, PermissionError} from '../../fs/errors.js';
import {ProcessGroup} from '../../threadTable.js';

// TODO: make pids 64 bits, probably requires moving this to an osoap syscall

const getpgid = (dv, thread) => {
  const pid = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  if (pid !== 0) {
    debugger;
    thread.requestUserDebugger();
    throw new SyscallError(E.SRCH);
  } else {
    const pgid = thread.process.processGroup.processGroupId;
    return pgid;
  }
};

const zeroDefault = (num, def) => {
  return num ? num : def;
};

const getChildOrSelfProcess = (process, pid) => {
  if (pid === process.processId) return process;
  const childProcess = process.children.get(pid);
  if (childProcess === undefined) throw new SyscallError(E.SRCH);
  return childProcess;
};

const setpgid = (dv, thread) => {
  const callingPid = thread.process.processId;
  const session = thread.process.processGroup.session;
  const pid = zeroDefault(dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true), callingPid);
  const pgid = zeroDefault(dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true), pid);
  const childProcess = getChildOrSelfProcess(thread.process, pid);
  if (childProcess.hasExeced) throw new AccessError();
  if (pgid < 0) throw new InvalidError();
  if (childProcess.isSessionLeader()) throw new PermissionError();
  if (childProcess.processGroup.session !== session) throw new PermissionError();
  const newProcessGroup = session.processGroups.get(pgid);
  if (newProcessGroup !== undefined) {
    childProcess.setProcessGroup(newProcessGroup);
  } else if (pgid === pid) {
    const ownProcessGroup = new ProcessGroup(session, pgid);
    childProcess.setProcessGroup(ownProcessGroup);
  } else {
    throw new PermissionError();
  }
  return 0;
};

export {getpgid, setpgid};
