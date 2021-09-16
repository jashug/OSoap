import {SYSBUF_OFFSET, OSOAP_SYS} from '../constants/syscallBufferLayout.js';
import {SYS} from '../syscall/linux/syscall.js';
import {E} from '../syscall/linux/errno.js';

// CAUTION: this depends on the user-side implementation of syscalls.

const syscallFork = (memory, sys_buf) => {
  const syncWord = new Int32Array(
    memory.buffer,
    sys_buf + SYSBUF_OFFSET.sync_word,
    1,
  );
  const dv = new DataView(memory.buffer);
  dv.setUint32(sys_buf + SYSBUF_OFFSET.tag, OSOAP_SYS.TAG.W.linux_syscall, true);
  dv.setUint32(sys_buf + SYSBUF_OFFSET.linux_syscall.n, SYS.fork, true);
  dv.setUint32(sys_buf + SYSBUF_OFFSET.linux_syscall.cnt, 0, true);
  // send syscall
  const old_state = Atomics.compareExchange(syncWord, 0, OSOAP_SYS.TURN.USER, OSOAP_SYS.TURN.KERNEL);
  if (old_state !== OSOAP_SYS.TURN.USER) {
    return -E.AGAIN; // Should be handled by poll_signals after return.
  }
  Atomics.notify(syncWord, 0, 1);
  Atomics.wait(syncWord, 0, OSOAP_SYS.TURN.KERNEL);
  // fork is *not* restartable
  return dv.getInt32(sys_buf + SYSBUF_OFFSET.linux_syscall_return, true);
};

export {syscallFork};
