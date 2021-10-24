import {InvalidError} from './InvalidError.js';
import {getPtr, getInt32, getFd} from '../SyscallBuffer.js';
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

const access = (sysbuf, thread) => {
  const pathname = getPtr(sysbuf.linuxSyscallArg(0));
  const mode = getInt32(sysbuf.linuxSyscallArg(1));
  return doAccess(sysbuf.dv, thread, AT.FDCWD, pathname, mode, 0);
};

const faccessat2 = (sysbuf, thread) => {
  const dirfd = getFd(sysbuf.linuxSyscallArg(0));
  const pathname = getPtr(sysbuf.linuxSyscallArg(1));
  const mode = getInt32(sysbuf.linuxSyscallArg(2));
  const flags = getInt32(sysbuf.linuxSyscallArg(3));
  return doAccess(sysbuf.dv, thread, dirfd, pathname, mode, flags);
};

export {access, faccessat2};
