import {InvalidError} from './InvalidError.js';
import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {pathFromCString} from '../../fs/Path.js';
import {resolveToEntry} from '../../fs/resolve.js';

const readlink = async (dv, thread) => {
  const pathname = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const bufptr = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const bufsize = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  if (bufsize <= 0) throw new InvalidError();
  const path = pathFromCString(dv.buffer, pathname + dv.byteOffset);
  const buf = new Uint8Array(dv.buffer, bufptr + dv.byteOffset, bufsize);
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
