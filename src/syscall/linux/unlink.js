import {pathFromCString, isDot, isDotDot} from '../../fs/Path.js';
import {resolveParent} from '../../fs/resolve.js';
import {AT} from '../../constants/at.js';
import {IsADirectoryError, NoEntryError, NotEmptyError, BusyError} from '../../fs/errors.js';
import {InvalidError} from './InvalidError.js';

const doUnlink = (path, curdir, rootdir, thread) => {
  if (path.isEmptyPath()) throw new NoEntryError();
  if (!path.hasLastComponent() || path.trailingSlash) throw new IsADirectoryError();
  return resolveParent(path, curdir, rootdir, {}, (parent) => {
    if (isDot(path.lastComponent) || isDotDot(path.lastComponent)) throw new IsADirectoryError();
    return parent.unlink(path.lastComponent, thread);
  });
};

const doRmdir = (path, curdir, rootdir, thread) => {
  if (path.isEmptyPath()) throw new NoEntryError();
  if (!path.hasLastComponent()) throw new BusyError(); // Root directory of the process
  return resolveParent(path, curdir, rootdir, {}, (parent) => {
    if (isDot(path.lastComponent)) throw new InvalidError();
    if (isDotDot(path.lastComponent)) throw new NotEmptyError();
    return parent.rmdir(path.lastComponent, thread);
  });
};

const UNLINKAT_ALLOWED_FLAGS = (
  AT.REMOVE_DIR |
0);

const unlinkat = (sysbuf, thread) => {
  const dirfd = sysbuf.linuxSyscallArg(0).getFd();
  const pathname = sysbuf.linuxSyscallArg(1).getPtr();
  const flags = sysbuf.linuxSyscallArg(2).getInt32();
  if (flags & ~UNLINKAT_ALLOWED_FLAGS) throw new InvalidError();
  const path = pathFromCString(sysbuf.buffer, pathname + sysbuf.byteOffset);
  const curdir = thread.process.fdtable.getExtended(dirfd);
  const rootdir = thread.process.fdtable.rootDirectory;
  if (flags & AT.REMOVE_DIR) return doRmdir(path, curdir, rootdir);
  else return doUnlink(path, curdir, rootdir);
};

const rmdir = (sysbuf, thread) => {
  const pathname = sysbuf.linuxSyscallArg(0).getPtr();
  const path = pathFromCString(sysbuf.buffer, pathname + sysbuf.byteOffset);
  const curdir = thread.process.fdtable.currentWorkingDirectory;
  const rootdir = thread.process.fdtable.rootDirectory;
  return doRmdir(path, curdir, rootdir);
};

const unlink = (sysbuf, thread) => {
  const pathname = sysbuf.linuxSyscallArg(0).getPtr();
  const path = pathFromCString(sysbuf.buffer, pathname + sysbuf.byteOffset);
  const curdir = thread.process.fdtable.currentWorkingDirectory;
  const rootdir = thread.process.fdtable.rootDirectory;
  return doUnlink(path, curdir, rootdir);
};

export {unlinkat, rmdir, unlink};