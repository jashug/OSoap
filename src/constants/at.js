// from fcntl.h
const AT = {
  FDCWD: -100,
  SYMLINK_NOFOLLOW: 0x100,
  REMOVE_DIR: 0x200,
  SYMLINK_FOLLOW: 0x400,
  EACCESS: 0x200,
  NO_AUTOMOUNT: 0x800,
  EMPTY_PATH: 0x1000,
  STATX: {
    SYNC_TYPE: 0x6000,
    SYNC_AS_STAT: 0x0000,
    FORCE_SYNC: 0x2000,
    DONT_SYNC: 0x4000,
  },
  RECURSIVE: 0x8000,
};

export {AT};