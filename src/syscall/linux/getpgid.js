import {SyscallError} from './SyscallError.js';
import {E} from './errno.js';
import {InvalidError} from './InvalidError.js';
import {AccessError, PermissionError} from '../../fs/errors.js';
import {ProcessGroup} from '../../threadTable.js';

const getpgid = (sysbuf, thread) => {
  const pid = sysbuf.linuxSyscallArg(0).getPid();
  if (pid) {
    debugger;
    thread.requestUserDebugger();
    throw new SyscallError(E.SRCH);
  } else {
    return thread.process.processGroup.processGroupId;
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

const setpgid = (sysbuf, thread) => {
  const callingPid = thread.process.processId;
  const session = thread.process.processGroup.session;
  const pid = zeroDefault(sysbuf.linuxSyscallArg(0).getPid(), callingPid);
  const pgid = zeroDefault(sysbuf.linuxSyscallArg(1).getPid(), pid);
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
