import {getPtr} from '../SyscallBuffer.js';
import {pathFromCString} from '../../fs/Path.js';
import {resolveToEntry} from '../../fs/resolve.js';

const chdir = async (sysbuf, thread) => {
  const pathPtr = getPtr(sysbuf.linuxSyscallArg(0));
  const path = pathFromCString(sysbuf.buffer, pathPtr + sysbuf.byteOffset);
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
