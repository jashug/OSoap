import {InvalidError} from './InvalidError.js';
import {pathFromCString, isDots} from '../../fs/Path.js';
import {resolveParent, resolveToEntry} from '../../fs/resolve.js';
import {O} from '../../constants/fs.js';
import {FileDescriptor} from '../../FileDescriptor.js';

const HANDLED_FLAGS = (
  O.READ |
  O.WRITE |
  O.LARGEFILE | // Always large files
  O.NOCTTY | // Open isn't enough to claim a controlling terminal
  O.CREAT |
  O.EXCL |
  O.CLOEXEC |
  O.NONBLOCK |
  O.DIRECTORY |
  O.TRUNC |
  O.APPEND |
0);

const open = async (sysbuf, thread) => {
  const pathname = sysbuf.linuxSyscallArg(0).getPtr();
  const flags = sysbuf.linuxSyscallArg(1).getInt32();
  const path = pathFromCString(sysbuf.buffer, pathname + sysbuf.byteOffset);
  if (flags & ~HANDLED_FLAGS) {
    console.log(`Some unhandled flags: ${(flags & ~HANDLED_FLAGS).toString(8)}`);
    throw new InvalidError();
  }
  if (flags & O.RDWR === 0) {
    throw new InvalidError();
  }
  // const accessMode = flags & O.ACCMODE; // Read, Write, Path bits
  const curdir = thread.process.currentWorkingDirectory;
  const rootdir = thread.process.rootDirectory;
  const mustBeDirectory = Boolean(flags & O.DIRECTORY) || path.trailingSlash || (path.hasLastComponent() && !isDots(path.lastComponent));
  const openFile = await (() => {
    if (flags & O.CREAT && !mustBeDirectory) {
      // TODO: Also want mode for O.TMPFILE
      const mode = sysbuf.linuxSyscallArg(2).getMode(); // Only set sometimes
      return resolveParent(path, curdir, rootdir, {
        allowEmptyPath: false,
      }, (predecessor, name) => {
        if (name === null) throw new Error("invariant broken");
        return predecessor.openCreate(flags, mode, name, thread);
      });
    } else {
      return resolveToEntry(path, curdir, rootdir, {
        allowEmptyPath: false,
        mustBeDirectory,
      }, (entry) => {
        return entry.openExisting(flags, thread);
      });
    }
  })();
  const fd = new FileDescriptor(openFile, Boolean(flags & O.CLOEXEC));
  const fdnum = thread.process.fdtable.allocate(fd);
  return fdnum;
};

export {open};
