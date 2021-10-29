import {InvalidError} from './InvalidError.js';
import {pathFromCString} from '../../fs/Path.js';
import {resolveToEntry} from '../../fs/resolve.js';

const readlink = async (sysbuf, thread) => {
  const pathname = sysbuf.linuxSyscallArg(0).getPtr();
  const bufptr = sysbuf.linuxSyscallArg(1).getPtr();
  const bufsize = sysbuf.linuxSyscallArg(2).getUint32();
  if (bufsize <= 0) throw new InvalidError();
  const path = pathFromCString(sysbuf.buffer, pathname + sysbuf.byteOffset);
  const buf = sysbuf.subUint8Array(bufptr, bufsize);
  const curdir = thread.process.currentWorkingDirectory;
  const rootdir = thread.process.rootDirectory;
  const linkBuf = await resolveToEntry(path, curdir, rootdir, {
    followLastSymlink: false,
    allowEmptyPath: false,
  }, (filePointer) => {
    return filePointer.readlink(thread);
  });
  const setLength = Math.min(buf.length, linkBuf.length);
  buf.set(linkBuf.subarray(0, setLength));
  return setLength;
};

export {readlink};
