import {SyscallError} from './SyscallError.js';
import {E} from './errno.js';
import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {pathFromCString} from '../../fs/Path.js';
import {resolveParent, resolveToEntry} from '../../fs/resolve.js';

const O_PATH = 0o10000000;

const O = {
  SEARCH: O_PATH,
  EXEC: O_PATH,
  ACCMODE: 0o3 | O_PATH,
  RDONLY: 0o1,
  WRONLY: 0o2,
  RDWR: 0o3,
  CREAT: 0o100,
  EXCL: 0o200,
  NOCTTY: 0o400,
  TRUNC: 0o1000,
  APPEND: 0o2000,
  NONBLOCK: 0o4000,
  DSYNC: 0o10000,
  SYNC: 0o4010000,
  RSYNC: 0o4010000,
  DIRECTORY: 0o200000,
  NOFOLLOW: 0o400000,
  CLOEXEC: 0o2000000,
  ASYNC: 0o20000,
  DIRECT: 0o40000,
  LARGEFILE: 0o100000,
  NOATIME: 0o1000000,
  PATH: O_PATH,
  TMPFILE: 0o20200000,
};

const HANDLED_FLAGS = (
  O.RDONLY |
  O.LARGEFILE | // Always large files
  O.NOCTTY | // Open isn't enough to claim a controlling terminal
  O.CREAT |
0);

const FILE_CREATION_FLAGS = (
  O.CLOEXEC |
  O.CREAT |
  O.DIRECTORY |
  O.EXCL |
  O.NOCTTY |
  O.NOFOLLOW |
  O.TMPFILE |
  O.TRUNC |
0);

const open = async (dv, thread) => {
  const pathname = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const flags = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  if (flags & ~HANDLED_FLAGS) {
    console.log(`Some unhandled flags: ${(flags & ~HANDLED_FLAGS).toString(8)}`);
    throw new SyscallError(E.INVAL);
  }
  const accessMode = flags & O.ACCMODE; // Read, Write, Path bits
  const path = pathFromCString(dv.buffer, pathname + dv.byteOffset);
  const curdir = thread.process.currentWorkingDirectory;
  const rootdir = thread.process.rootDirectory;
  if (flags & O.CREAT) {
    // TODO
    // Also want mode for O.TMPFILE
    const mode = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true); // Only set sometimes
    const predecessor = await resolveParent(path, curdir, rootdir, {
      allowEmptyPath: false,
    });
    debugger;
    thread.requestUserDebugger();
    void predecessor;
    void mode;
    throw new SyscallError(E.INVAL);
  } else {
    const entry = await resolveToEntry(path, curdir, rootdir, {
      allowEmptyPath: false,
    });
    debugger;
  }
  thread.requestUserDebugger();
  return 0;
};

export {open};
