import {getFd, getInt32, getInt64} from '../SyscallBuffer.js';
import {SEEK} from '../../constants/fs.js';
import {InvalidError} from './InvalidError.js';
import {OverflowError} from './OverflowError.js';

const whencePossibilities = new Set([SEEK.SET, SEEK.CUR, SEEK.END]);

const lseek = (sysbuf, thread) => {
  const fd = getFd(sysbuf.linuxSyscallArg(0));
  const offset = getInt64(sysbuf.linuxSyscallArg(1));
  if (offset > Number.MAX_SAFE_INTEGER) throw new OverflowError();
  const whence = getInt32(sysbuf.linuxSyscallArg(2));
  if (!whencePossibilities.has(whence)) throw new InvalidError();
  return thread.process.fdtable.get(fd).openFileDescription.lseek(Number(offset), whence, thread);
};

export {lseek};
