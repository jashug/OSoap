import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {AT} from '../../constants/fileDescriptors.js';
import {pathFromCString} from '../../fs/Path.js';
import {resolveToEntry} from '../../fs/resolve.js';

const statx = async (dv, thread) => {
  const dirfd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const pathname = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const flags = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const mask = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 3, true);
  const statbuf = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 4, true);
  const path = pathFromCString(dv.buffer, pathname + dv.byteOffset);
  if (dirfd !== AT.FDCWD) {
    debugger;
    // TODO
    throw new Error("stat at not implemented");
  }
  if (flags & ~0) {
    throw new Error(`stat flags ${flags & ~0} not implemented`);
  }
  const curdir = thread.process.currentWorkingDirectory;
  const rootdir = thread.process.rootDirectory;
  const filePointer = await resolveToEntry(path, curdir, rootdir);
  debugger;
  thread.requestUserDebugger();
  return 0;
};

export {statx};
