import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {NAME_MAX, FMT} from '../../constants/fs.js';
import {InvalidError} from './InvalidError.js';

const DENT_NAME_OFFSET = 8 + 8 + 2 + 1;
const DENT_LEN_MAX = DENT_NAME_OFFSET + NAME_MAX + 1;

const DT = new Map([
  [FMT.FIFO, 1],
  [FMT.DEVICE, 2],
  [FMT.DIRECTORY, 4],
  [FMT.REGULAR, 8],
  [FMT.SYMLINK, 10],
  [FMT.SOCKET, 12],
]);

const getdents = async (dv, thread) => {
  const fd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const buf = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const bufLen = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  if (bufLen < DENT_LEN_MAX) throw new InvalidError();
  const file = thread.process.fdtable.get(fd).openFileDescription;
  let bufCur = 0;
  while (bufLen - bufCur >= DENT_LEN_MAX) {
    const dirEntry = await file.readDirEntry(thread);
    if (dirEntry === null) break;
    const {id, tellPos, fmt, nameBuf} = dirEntry;
    if (nameBuf.length > NAME_MAX) throw new Error(`nameLen out of range ${nameBuf.length}`);
    const reclen = DENT_NAME_OFFSET + nameBuf.length + 1;
    const typeCode = DT.get(fmt) ?? 0;
    dv.setBigUint64(buf + bufCur, id, true);
    dv.setBigUint64(buf + bufCur + 8, tellPos, true);
    dv.setUint16(buf + bufCur + 16, reclen, true);
    dv.setUint8(buf + bufCur + 18, typeCode, true);
    const nameBuffer = new Uint8Array(dv.buffer, dv.byteOffset + buf + bufCur + DENT_NAME_OFFSET, nameBuf.length + 1);
    nameBuffer.set(nameBuf);
    nameBuffer[nameBuf.length] = 0;
    bufCur += reclen;
  }
  return bufCur;
};

export {getdents};
