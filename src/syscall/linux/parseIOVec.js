import {InvalidError} from './InvalidError.js';

const IOV_MAX = 1024;

const parseIOVec = (dv, iov, iovcnt) => {
  if (iovcnt < 0 || iovcnt > IOV_MAX) throw new InvalidError();
  const data = [];
  let totalLen = 0;
  for (let i = 0; i < iovcnt; i++) {
    const iov_base = dv.getUint32(iov + i * 8, true);
    const iov_len = dv.getUint32(iov + i * 8 + 4, true);
    data.push(new Uint8Array(dv.buffer, iov_base + dv.byteOffset, iov_len));
    totalLen += iov_len;
  }
  if (totalLen >= Math.pow(2, 31)) throw new InvalidError();
  return {data, totalLen};
};

export {parseIOVec};
