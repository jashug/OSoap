import {InvalidError} from './InvalidError.js';
import {PROCESS_STATUS_STATE} from '../../threadTable.js';

// TODO: make pids 64 bits

const W = {
  NOHANG: 1,
  UNTRACED: 2,
  CONTINUED: 8,
  STOPPED: 2,
  EXITED: 4,
  NOWAIT: 0x1000000,
};

const filterAll = () => true;
const filterPid = (pid) => (process) => process.processId === pid;
const filterPgid = (pgid) => (process) => process.processGroup.processGroupId === pgid;
const selectFilterPid = (parentProcess, pid) => {
  if (pid < -1n) return filterPgid(-pid);
  else if (pid === -1n) return filterAll;
  else if (pid === 0n) return filterPgid(parentProcess.processGroup.processGroupId);
  else return filterPid(pid);
};

const selectFilterOptions = (options) => (process) => {
  return process.status !== null && (
    process.status.state === PROCESS_STATUS_STATE.TERMINATED ||
    process.status.state === PROCESS_STATUS_STATE.CONTINUED && Boolean(options & W.CONTINUED) ||
    process.status.state === PROCESS_STATUS_STATE.STOPPED && Boolean(options & W.UNTRACED)
  );
};

const wait4 = (sysbuf, thread) => {
  const pid = sysbuf.linuxSyscallArg(0).getPid();
  const wstatusPtr = sysbuf.linuxSyscallArg(1).getPtr();
  const options = sysbuf.linuxSyscallArg(2).getInt32();
  const rusagePtr = sysbuf.linuxSyscallArg(3).getPtr();
  if (rusagePtr !== 0) {
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }
  if (options & ~(W.UNTRACED | W.CONTINUED)) {
    console.log(`Unhandled flag to wait: ${options.toString(16)}`);
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }
  const filterPid = selectFilterPid(thread.process, pid);
  const filterOptions = selectFilterOptions(options);
  const handleChild = (child) => {
    if (filterPid(child) && filterOptions(child)) {
      const status = child.status;
      child.status = null; // TODO: Except for waitid with NOWAIT flag
      if (wstatusPtr !== 0) sysbuf.dv.setInt32(wstatusPtr, status.reason, true);
      return child.processId;
    }
  };
  for (const child of thread.process.children.values()) {
    const result = handleChild(child);
    if (result) return result;
  }
  if (options & W.NOHANG) return 0;
  return new Promise((resolve) => {
    const waiter = {
      notify(child) {
        const result = handleChild(child);
        if (result) {
          thread.process.waiters.delete(waiter);
          resolve(result);
          return true;
        } else return false;
      },
    };
    thread.process.waiters.add(waiter);
    // TODO: allow signals to cancel
  });
};

export {wait4};
