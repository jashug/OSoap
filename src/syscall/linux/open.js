import {SyscallError} from './SyscallError.js';
import {E} from './errno.js';
import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {pathFromCString} from '../../fs/Path.js';
import {resolveParent, resolveToEntry} from '../../fs/resolve.js';
import {FMT, O} from '../../constants/fs.js';
import {FileDescriptor} from '../../FileDescriptor.js';

const HANDLED_FLAGS = (
  O.READ |
  O.LARGEFILE | // Always large files
  O.NOCTTY | // Open isn't enough to claim a controlling terminal
  O.CREAT |
  O.CLOEXEC |
0);

const open = async (dv, thread) => {
  const pathname = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const flags = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  if (flags & ~HANDLED_FLAGS) {
    console.log(`Some unhandled flags: ${(flags & ~HANDLED_FLAGS).toString(8)}`);
    throw new SyscallError(E.INVAL);
  }
  if (flags & O.RDWR === 0) {
    throw new SyscallError(E.INVAL);
  }
  // const accessMode = flags & O.ACCMODE; // Read, Write, Path bits
  const path = pathFromCString(dv.buffer, pathname + dv.byteOffset);
  const curdir = thread.process.currentWorkingDirectory;
  const rootdir = thread.process.rootDirectory;
  if (flags & O.CREAT) {
    // TODO
    // Also want mode for O.TMPFILE
    const mode = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true); // Only set sometimes
    const fd = await resolveParent(path, curdir, rootdir, {
      allowEmptyPath: false,
    }, (predecessor) => {
      void predecessor;
      debugger;
    });
    debugger;
    thread.requestUserDebugger();
    void fd;
    void mode;
    throw new SyscallError(E.INVAL);
  } else {
    const fd = await resolveToEntry(path, curdir, rootdir, {
      allowEmptyPath: false,
    }, async (entry) => {
      if (entry.fileType === FMT.DIRECTORY) {
        if (flags & O.WRITE) throw new SyscallError(E.ISDIR);
        // TODO: opening directories
        debugger;
        thread.requestUserDebugger();
        throw new SyscallError(E.INVAL);
      } else if (entry.fileType === FMT.REGULAR) {
        const openFile = await entry.openExisting(flags);
        const fd = new FileDescriptor(openFile, Boolean(flags & O.CLOEXEC));
        const fdnum = thread.process.fdtable.allocate(fd);
        return fdnum;
      } else {
        // TODO: opening other types of files
        debugger;
        thread.requestUserDebugger();
        throw new SyscallError(E.INVAL);
      }
    });
    return fd;
  }
};

export {open};
