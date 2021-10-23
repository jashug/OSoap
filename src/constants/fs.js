const FMT = {
  REGULAR: 1,
  DIRECTORY: 2,
  SYMLINK: 3,
  DEVICE: 4,
  FIFO: 5,
  SOCKET: 6,
};

const FMT_TO_MODE = new Map([
  [FMT.REGULAR, 0o100000],
  [FMT.DIRECTORY, 0o040000],
  [FMT.SYMLINK, 0o120000],
  [FMT.DEVICE, 0o020000],
  [FMT.FIFO, 0o010000],
  [FMT.SOCKET, 0o140000],
]);

const fmtToMode = (fmt) => FMT_TO_MODE.get(fmt);

const ACCESS = {
  R: 4,
  W: 2,
  X: 1,
};

const O_PATH = 0o10000000;

const O = {
  SEARCH: O_PATH,
  EXEC: O_PATH,
  ACCMODE: 0o3 | O_PATH,
  READ: 0o1,
  WRITE: 0o2,
  RDWR: 0o3,
  CREAT: 0o100,
  EXCL: 0o200,
  NOCTTY: 0o400,
  TRUNC: 0o1000,
  APPEND: 0o2000,
  NONBLOCK: 0o4000,
  DSYNC: 0o10000,
  SYNC: 0o4010000,
  RSYNC: 0o4010000,
  DIRECTORY: 0o200000,
  NOFOLLOW: 0o400000,
  CLOEXEC: 0o2000000,
  ASYNC: 0o20000,
  DIRECT: 0o40000,
  LARGEFILE: 0o100000,
  NOATIME: 0o1000000,
  PATH: O_PATH,
  TMPFILE: 0o20200000,
};

const FILE_CREATION_FLAGS = (
  O.CLOEXEC |
  O.CREAT |
  O.DIRECTORY |
  O.EXCL |
  O.NOCTTY |
  O.NOFOLLOW |
  O.TMPFILE |
  O.TRUNC |
0);

const FILE_STATUS_FLAGS = (
  O.APPEND |
  O.ASYNC |
  O.DIRECT |
  O.DSYNC |
  O.LARGEFILE |
  O.NOATIME |
  O.NONBLOCK |
  O.SYNC |
0);

const NAME_MAX = 255;

const SEEK = {
  SET: 0,
  CUR: 1,
  END: 2,
};

export {FMT, fmtToMode, ACCESS, O, FILE_CREATION_FLAGS, FILE_STATUS_FLAGS, NAME_MAX, SEEK};
