import {getUint32, getPtr} from '../SyscallBuffer.js';
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

const clock_gettime = (sysbuf, thread) => {
  void thread;
  const clockId = getUint32(sysbuf.linuxSyscallArg(0));
  const timePointer = getPtr(sysbuf.linuxSyscallArg(1));
  const time = (gettime.get(clockId) ?? unknownClockId(clockId))();
  sysbuf.dv.setBigInt64(timePointer + 0, time.sec, true);
  sysbuf.dv.setUint32(timePointer + 8, time.nsec, true);
  return 0;
};

export {clock_gettime};
