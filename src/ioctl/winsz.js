const getWinSize = (winszPtr, dv, size) => {
  dv.setUint16(winszPtr + 0, size.row, true);
  dv.setUint16(winszPtr + 2, size.col, true);
  dv.setUint16(winszPtr + 4, size.xpixel, true);
  dv.setUint16(winszPtr + 6, size.ypixel, true);
};

export {getWinSize};
