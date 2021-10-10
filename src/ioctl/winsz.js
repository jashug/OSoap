const getWinSize = (winszPtr, dv, size) => {
  dv.setUint16(winszPtr + 0, size.row, true);
  dv.setUint16(winszPtr + 2, size.col, true);
  dv.setUint16(winszPtr + 4, size.xpixel, true);
  dv.setUint16(winszPtr + 6, size.ypixel, true);
};

const setWinSize = (winszPtr, dv) => {
  return {
    row: dv.getUint16(winszPtr + 0, true),
    col: dv.getUint16(winszPtr + 2, true),
    xpixel: dv.getUint16(winszPtr + 4, true),
    ypixel: dv.getUint16(winszPtr + 6, true),
  };
};

export {getWinSize, setWinSize};
