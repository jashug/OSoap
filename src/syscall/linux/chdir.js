import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {pathFromCString} from '../../fs/Path.js';
import {resolveToEntry} from '../../fs/resolve.js';

const chdir = async (dv, thread) => {
  const pathPtr = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const path = pathFromCString(dv.buffer, pathPtr + dv.byteOffset);
  const curdir = thread.process.currentWorkingDirectory;
  const rootdir = thread.process.rootDirectory;
  const newCurDir = await resolveToEntry(path, curdir, rootdir, {
    allowEmptyPath: false,
    mustBeDirectory: true,
  }, (filePointer) => filePointer.incRefCount());
  thread.process.currentWorkingDirectory = newCurDir;
  return 0;
};

export {chdir};
