import {InvalidError} from './InvalidError.js';

const nanosleep = async (sysbuf, thread) => {
  void thread;
  const askPointer = sysbuf.linuxSyscallArg(0).getPtr();
  const remPointer = sysbuf.linuxSyscallArg(1).getPtr();
  const askSec = sysbuf.dv.getBigInt64(askPointer + 0, true);
  const askNsec = sysbuf.dv.getUint32(askPointer + 8, true);
  if (askNsec < 0 || askNsec >= 1000000000) throw new InvalidError();
  if (askSec > 1000000000000n) {
    console.log(`Too long timeout ${askSec} seconds`);
    debugger;
    throw new InvalidError();
  }
  void remPointer;
  // TODO: handle interruptions
  const msecToWait = Number(askSec) * 1000 + askNsec / 1000000;
  await new Promise((resolve) => {
    setTimeout(() => resolve, msecToWait);
  });
  return 0;
};

export {nanosleep};
