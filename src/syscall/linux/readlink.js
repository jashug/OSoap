import {InvalidError} from './InvalidError.js';
import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {pathFromCString} from '../../fs/Path.js';
import {resolveToEntry} from '../../fs/resolve.js';

const readlink = (dv, thread) => {
  const pathname = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const bufptr = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const bufsize = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const path = pathFromCString(dv.buffer, pathname + dv.byteOffset);
  const buf = new Uint8Array(dv.buffer, bufptr + dv.byteOffset, bufsize);
  debugger;
  thread.requestUserDebugger();
  throw new InvalidError();
};

export {readlink};
