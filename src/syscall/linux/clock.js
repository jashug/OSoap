import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {InvalidError} from './InvalidError.js';
import {currentTimespec} from '../../util/currentTime.js';

// This and more in time.h
const CLOCK = {
  REALTIME: 0,
  MONOTONIC: 1,
};

const unknownClockId = (clockId) => () => {
  console.log(`Request for unknown clock id ${clockId}`);
  throw new InvalidError();
};

const gettime = new Map([
  [CLOCK.REALTIME, currentTimespec],
  [CLOCK.MONOTONE, () => {
    // TODO
    debugger;
    console.log("TODO: monotone clock");
    throw new InvalidError();
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
