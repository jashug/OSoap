import {SEEK} from '../../constants/fs.js';
import {InvalidError} from './InvalidError.js';
import {OverflowError} from './OverflowError.js';

const whencePossibilities = new Set([SEEK.SET, SEEK.CUR, SEEK.END]);

const lseek = (sysbuf, thread) => {
  const fd = sysbuf.linuxSyscallArg(0).getFd();
  const offset = sysbuf.linuxSyscallArg(1).getInt64();
  if (offset > Number.MAX_SAFE_INTEGER) throw new OverflowError();
  const whence = sysbuf.linuxSyscallArg(2).getInt32();
  if (!whencePossibilities.has(whence)) throw new InvalidError();
  return thread.process.fdtable.get(fd).openFileDescription.lseek(Number(offset), whence, thread);
};

export {lseek};
