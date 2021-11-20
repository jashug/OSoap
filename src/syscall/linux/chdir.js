import {pathFromCString, SLASH_CODE} from '../../fs/Path.js';
import {resolveToEntry} from '../../fs/resolve.js';
import {LinuxRangeError} from './LinuxRangeError.js';

const getcwd = (sysbuf, thread) => {
  void thread;
  // TODO: this is a stub, always returning /
  const bufPtr = sysbuf.linuxSyscallArg(0).getPtr();
  const size = sysbuf.linuxSyscallArg(1).getInt32(); // really size_t
  const buf = sysbuf.subUint8Array(bufPtr, size);
  if (size < 2) throw new LinuxRangeError();
  buf[0] = SLASH_CODE;
  buf[1] = 0;
  return bufPtr;
};

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

export {chdir, fchdir, getcwd};
