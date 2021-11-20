import {pathFromCString} from '../../fs/Path.js';
import {resolveParent} from '../../fs/resolve.js';
import {AT} from '../../constants/at.js';
import {ExistsError} from '../../fs/errors.js';

// TODO: add support for dirfd
const doMakeDir = (dirfd, path, mode, thread) => {
  const maskedMode = mode & ~thread.process.fileModeCreationMask & 0o777;
  const curdir = thread.process.fdtable.getExtended(dirfd);
  return resolveParent(path, curdir, thread.process.fdtable.rootDirectory, {}, async (parent, name) => {
    if (name === null) throw new ExistsError();
    await parent.mkdir(name, maskedMode, thread);
    return 0;
  });
};

const mkdir = (sysbuf, thread) => {
  const pathname = sysbuf.linuxSyscallArg(0).getPtr();
  const mode = sysbuf.linuxSyscallArg(1).getMode();
  const path = pathFromCString(sysbuf.buffer, pathname + sysbuf.byteOffset);
  return doMakeDir(AT.FDCWD, path, mode, thread);
};

const mkdirat = (sysbuf, thread) => {
  const dirfd = sysbuf.linuxSyscallArg(0).getFd();
  const pathname = sysbuf.linuxSyscallArg(1).getPtr();
  const mode = sysbuf.linuxSyscallArg(2).getMode();
  const path = pathFromCString(sysbuf.buffer, pathname + sysbuf.byteOffset);
  return doMakeDir(dirfd, path, mode, thread);
};

export {mkdir, mkdirat};
