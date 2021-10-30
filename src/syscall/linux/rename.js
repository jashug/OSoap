import {pathFromCString} from '../../fs/Path.js';
import {resolveParent} from '../../fs/resolve.js';
import {InvalidError} from './InvalidError.js';

// TODO: renameat2 flags

const RENAME_FLAGS = (
0);

const doRename = (oldpath, oldcurdir, oldrootdir, newpath, newcurdir, newrootdir, flags, thread) => {
  if (flags & ~RENAME_FLAGS) throw new InvalidError();
  // TODO
  throw new InvalidError();
};

const renameat = (sysbuf, thread) => {
  const olddirfd = sysbuf.linuxSyscallArg(0).getFd();
  const oldpathname = sysbuf.linuxSyscallArg(1).getPtr();
  const newdirfd = sysbuf.linuxSyscallArg(2).getFd();
  const newpathname = sysbuf.linuxSyscallArg(3).getPtr();
  const oldpath = pathFromCString(sysbuf.buffer, oldpathname + sysbuf.byteOffset);
  const newpath = pathFromCString(sysbuf.buffer, newpathname + sysbuf.byteOffset);
  return doRename(
    oldpath,
    thread.process.fdtable.getExtended(olddirfd),
    thread.process.fdtable.rootDirectory,
    newpath,
    thread.process.fdtable.getExtended(newdirfd),
    thread.process.fdtable.rootDirectory,
    0,
    thread,
  );
};

export {renameat};
