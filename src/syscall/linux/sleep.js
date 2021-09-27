import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {InvalidError} from './InvalidError.js';

const nanosleep = async (dv, thread) => {
  const askPointer = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const remPointer = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const askSec = dv.getBigInt64(askPointer + 0, true);
  const askNsec = dv.getUint32(askPointer + 8, true);
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
