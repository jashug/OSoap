import {InvalidError} from './InvalidError.js';
import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {pathFromCString} from '../../fs/Path.js';
import {resolveToEntry} from '../../fs/resolve.js';
import {AT} from '../../constants/at.js';

const doAccess = async (dv, thread, dirfd, pathname, mode, flags) => {
  // R: 4, W: 2, X: 1
  if (mode & ~7) throw new InvalidError();
  if (dirfd !== AT.FDCWD) {
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }
  const path = pathFromCString(dv.buffer, pathname + dv.byteOffset);
  const curdir = thread.process.currentWorkingDirectory;
  const rootdir = thread.process.rootDirectory;
  await resolveToEntry(path, curdir, rootdir, {
    followLastSymlink: ~Boolean(flags & AT.SYMLINK_NOFOLLOW),
    allowEmptyPath: false,
  }, (filePointer) => {
    filePointer.access(mode, Boolean(flags & AT.EACCESS), thread);
  });
  return 0;
};

const access = (dv, thread) => {
  const pathname = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const mode = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  return doAccess(dv, thread, AT.FDCWD, pathname, mode, 0);
};

const faccessat2 = (dv, thread) => {
  const dirfd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const pathname = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const mode = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const flags = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 3, true);
  return doAccess(dv, thread, dirfd, pathname, mode, flags);
};

export {access, faccessat2};
