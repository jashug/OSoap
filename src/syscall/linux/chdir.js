import {pathFromCString} from '../../fs/Path.js';
import {resolveToEntry} from '../../fs/resolve.js';

const chdir = async (sysbuf, thread) => {
  const pathPtr = sysbuf.linuxSyscallArg(0).getPtr();
  const path = pathFromCString(sysbuf.buffer, pathPtr + sysbuf.byteOffset);
  const curdir = thread.process.currentWorkingDirectory;
  const rootdir = thread.process.rootDirectory;
  const newCurDir = await resolveToEntry(path, curdir, rootdir, {
    allowEmptyPath: false,
    mustBeDirectory: true,
  }, (filePointer) => filePointer.incRefCount());
  // TODO: free previous cwd pointer
  thread.process.currentWorkingDirectory = newCurDir;
  return 0;
};

const fchdir = (sysbuf, thread) => {
  const fd = sysbuf.linuxSyscallArg(0).getFd();
  const newCurDir = thread.process.fdtable.get(fd).openFileDescription.fileLoc.incRefCount();
  // TODO: free previous cwd pointer
  thread.process.currentWorkingDirectory = newCurDir;
  return 0;
};

export {chdir, fchdir};
