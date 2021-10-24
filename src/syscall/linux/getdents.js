import {getFd, getPtr, getUint32} from '../SyscallBuffer.js';
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

const getdents = async (sysbuf, thread) => {
  const fd = getFd(sysbuf.linuxSyscallArg(0));
  const buf = getPtr(sysbuf.linuxSyscallArg(1));
  const bufLen = getUint32(sysbuf.linuxSyscallArg(2));
  const dv = sysbuf.dv;
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
    const nameBuffer = sysbuf.subUint8Array(buf + bufCur + DENT_NAME_OFFSET, nameBuf.length + 1);
    nameBuffer.set(nameBuf);
    nameBuffer[nameBuf.length] = 0;
    bufCur += reclen;
  }
  return bufCur;
};

export {getdents};
