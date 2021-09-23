import {SyscallError} from './SyscallError.js';
import {E} from './errno.js';
import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {AT} from '../../constants/at.js';
import {pathFromCString} from '../../fs/Path.js';
import {resolveToEntry} from '../../fs/resolve.js';

const STATX = {
  TYPE: 0x001,
  MODE: 0x002,
  NLINK: 0x004,
  UID: 0x008,
  GID: 0x010,
  ATIME: 0x020,
  MTIME: 0x040,
  CTIME: 0x080,
  INO: 0x100,
  SIZE: 0x200,
  BLOCKS: 0x400,
  BASIC_STATS: 0x7ff,
  BTIME: 0x800,
  ALL: 0xfff,
};

const STATX_OFFSET = {
  mask: 0,
  blksize: 4,
  attributes: 8,
  nlink: 16,
  uid: 20,
  gid: 24,
  mode: 28,
  ino: 32,
  size: 40,
  blocks: 48,
  attribute_mask: 56,
  atime: 64,
  btime: 80,
  ctime: 96,
  mtime: 112,
  rdev_major: 128,
  rdev_minor: 132,
  dev_major: 136,
  dev_minor: 140,
};

const TIMESPEC_OFFSET = {
  sec: 0,
  nsec: 8,
};

const parseSyncFlag = (flags) => {
  if (flags & AT.STATX.SYNC_TYPE === AT.STATX.FORCE_SYNC) return true;
  if (flags & AT.STATX.SYNC_TYPE === AT.STATX.DONT_SYNC) return false;
};

const ALLOWABLE_STATX_FLAGS = (
  AT.STATX.SYNC_TYPE |
  AT.EMPTY_PATH |
  AT.NO_AUTOMOUNT |
  AT.SYMLINK_NOFOLLOW
);

const setTimespec = (dv, offset, time) => {
  dv.setBigUint64(offset + TIMESPEC_OFFSET.sec, time.sec, true);
  dv.setUint32(offset + TIMESPEC_OFFSET.nsec, time.nsec, true);
};

const statx = async (dv, thread) => {
  const dirfd = dv.getInt32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const pathname = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const flags = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const mask = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 3, true);
  const statbuf = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 4, true);
  if (dirfd !== AT.FDCWD) {
    debugger;
    // TODO
    throw new Error("stat at not implemented");
  }
  if (flags & ~ALLOWABLE_STATX_FLAGS) {
    throw new SyscallError(E.INVAL);
  }
  const path = pathFromCString(dv.buffer, pathname + dv.byteOffset);
  const curdir = thread.process.currentWorkingDirectory;
  const rootdir = thread.process.rootDirectory;
  // We don't have automounts, so can ignore AT.NO_AUTOMOUNT
  const filePointer = await resolveToEntry(path, curdir, rootdir, {
    allowEmptyPath: flags & AT.EMPTY_PATH,
    followLastSymlink: !(flags & AT.SYMLINK_NOFOLLOW),
  });
  const syncFlag = parseSyncFlag(flags);
  const statInfo = await filePointer.stat(syncFlag, mask);
  let returnedMask = STATX.BASIC_STATS;
  dv.setUint32(statbuf + STATX_OFFSET.blksize, statInfo.blksize, true);
  dv.setUint32(statbuf + STATX_OFFSET.nlink, statInfo.nlink, true);
  dv.setUint32(statbuf + STATX_OFFSET.uid, statInfo.uid, true);
  dv.setUint32(statbuf + STATX_OFFSET.gid, statInfo.gid, true);
  dv.setUint16(statbuf + STATX_OFFSET.mode, statInfo.mode, true);
  dv.setBigUint64(statbuf + STATX_OFFSET.ino, filePointer.id, true);
  dv.setBigUint64(statbuf + STATX_OFFSET.size, statInfo.size, true);
  dv.setBigUint64(statbuf + STATX_OFFSET.blocks, statInfo.blocks, true);
  dv.setBigUint64(statbuf + STATX_OFFSET.attribute_mask, 0n, true);
  setTimespec(dv, statbuf + STATX_OFFSET.atime, statInfo.atime);
  if (statInfo.btime) {
    returnedMask |= STATX.BTIME;
    setTimespec(dv, statbuf + STATX_OFFSET.btime, statInfo.btime);
  }
  setTimespec(dv, statbuf + STATX_OFFSET.ctime, statInfo.ctime);
  setTimespec(dv, statbuf + STATX_OFFSET.mtime, statInfo.mtime);
  dv.setUint32(dv, statbuf + STATX_OFFSET.rdev_major, statInfo.rdev?.major ?? 0, true);
  dv.setUint32(dv, statbuf + STATX_OFFSET.rdev_minor, statInfo.rdev?.minor ?? 0, true);
  dv.setUint32(dv, statbuf + STATX_OFFSET.dev_major, filePointer.mount.fs.dev.major, true);
  dv.setUint32(dv, statbuf + STATX_OFFSET.dev_minor, filePointer.mount.fs.dev.minor, true);
  dv.setUint32(statbuf + STATX_OFFSET.mask, returnedMask, true);
  return 0;
};

export {statx};
