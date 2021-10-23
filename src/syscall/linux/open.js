import {InvalidError} from './InvalidError.js';
import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {pathFromCString} from '../../fs/Path.js';
import {resolveParent, resolveToEntry} from '../../fs/resolve.js';
import {O} from '../../constants/fs.js';
import {FileDescriptor} from '../../FileDescriptor.js';

const HANDLED_FLAGS = (
  O.READ |
  O.WRITE |
  O.LARGEFILE | // Always large files
  O.NOCTTY | // Open isn't enough to claim a controlling terminal
  O.CREAT |
  O.CLOEXEC |
  O.NONBLOCK |
  O.DIRECTORY |
  O.TRUNC |
0);

const open = async (dv, thread) => {
  const pathname = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const flags = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const path = pathFromCString(dv.buffer, pathname + dv.byteOffset);
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
  const mustBeDirectory = Boolean(flags & O.DIRECTORY) || path.trailingSlash;
  const openFile = await (() => {
    if (flags & O.CREAT && !mustBeDirectory && path.lastComponent !== null) {
      // TODO: Also want mode for O.TMPFILE
      const mode = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true); // Only set sometimes
      return resolveParent(path, curdir, rootdir, {
        allowEmptyPath: false,
      }, (predecessor) => {
        return predecessor.openCreate(flags, mode, path.lastComponent, thread);
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
