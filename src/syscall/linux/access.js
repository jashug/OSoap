import {SyscallError} from './SyscallError.js';
import {E} from './errno.js';
import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {pathFromCString} from '../../fs/Path.js';
import {resolveToEntry} from '../../fs/resolve.js';

const access = async (dv, thread) => {
  const pathname = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const mode = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  // R: 4, W: 2, X: 1
  if (mode & 7 !== mode) throw new SyscallError(E.INVAL);
  const path = pathFromCString(dv.buffer, pathname + dv.byteOffset);
  const curdir = thread.process.currentWorkingDirectory;
  const rootdir = thread.process.rootDirectory;
  const filePointer = await resolveToEntry(path, curdir, rootdir, {
    allowEmptyPath: false,
  });
  filePointer.access(mode);
  return 0;
};

export {access};
