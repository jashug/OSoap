const FMT = {
  REGULAR: 1,
  DIRECTORY: 2,
  SYMLINK: 3,
  DEVICE: 4,
  FIFO: 5,
  SOCKET: 6,
}

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
}

export {FMT, fmtToMode, ACCESS};
