import {SyscallError} from './SyscallError.js';
import {E} from './errno.js';
import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';

// This and more in time.h
const CLOCK = {
  REALTIME: 0,
  MONOTONIC: 1,
};

const unknownClockId = (clockId) => () => {
  console.log(`Request for unknown clock id ${clockId}`);
  throw new SyscallError(E.INVAL);
};

const gettime = new Map([
  [CLOCK.REALTIME, () => {
    const msSinceEpoch = Date.now();
    const secondsSinceEpoch = Math.floor(msSinceEpoch / 1000);
    const msLeftOver = msSinceEpoch - secondsSinceEpoch * 1000;
    if (msLeftOver < 0 || msLeftOver >= 1000) {
      throw new Error("Problem with time math");
    }
    const nsLeftOver = Math.floor(msLeftOver * 1000000);
    return {sec: BigInt(secondsSinceEpoch), nsec: nsLeftOver};
  }],
  [CLOCK.MONOTONE, () => {
    // TODO
    debugger;
    console.log("TODO: monotone clock");
    throw new SyscallError(E.INVAL);
  }],
]);

const clock_gettime = (dv, thread) => {
  const clockId = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const timePointer = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const time = (gettime.get(clockId) ?? unknownClockId(clockId))();
  dv.setBigInt64(timePointer + 0, time.sec, true);
  dv.setUint32(timePointer + 8, time.nsec, true);
  return 0;
};

export {clock_gettime};
