import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {InvalidError} from './InvalidError.js';

const nanosleep = (dv, thread) => {
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
  return new Promise((resolve) => {
    setTimeout(() => resolve(0), Number(askSec) * 1000 + askNsec / 1000000);
  });
};

export {nanosleep};
