import {SYSBUF_OFFSET, OSOAP_SYS} from '../constants/syscallBufferLayout.js';
import {E} from '../syscall/linux/errno.js';
import {UserError} from '../UserError.js';

const saveGlobals = (module, exports, dv) => {
  let save_global_offset = 0;
  for (const {kind, name, type: {mutable, value}} of WebAssembly.Module.exports(module)) {
    if (kind !== 'global' || !mutable) continue;
    if (value === 'i32') {
      dv.setUint32(save_global_offset, exports[name].value, true);
      save_global_offset += 4;
    } else if (value === 'i64') {
      dv.setBigUint64(save_global_offset, exports[name].value, true);
      save_global_offset += 8;
    } else {
      throw new Error(`Unrecognized wasm global type ${{name, type: {mutable, value}}}`);
    }
  }
};

const restoreGlobals = (module, exports, dv) => {
  let save_global_offset = 0;
  for (const {kind, name, type: {mutable, value}} of WebAssembly.Module.exports(module)) {
    if (kind !== 'global' || !mutable) continue;
    if (value === 'i32') {
      exports[name].value = dv.getUint32(save_global_offset, true);
      save_global_offset += 4;
    } else if (value === 'i64') {
      exports[name].value = dv.getBitUint64(save_global_offset, true);
      save_global_offset += 8;
    } else {
      throw new Error(`Unrecognized wasm global type ${{name, type: {mutable, value}}}`);
    }
  }
};

const getSyncWord = (memory, sys_buf) => {
  return new Int32Array(
    memory.buffer,
    sys_buf + SYSBUF_OFFSET.sync_word,
    1,
  );
};

const getSavedGlobalsDataView = (dv, sys_buf) => {
  return new DataView(
    dv.buffer,
    dv.byteOffset + sys_buf + SYSBUF_OFFSET.fork.saved_globals,
    SYSBUF_OFFSET.fork.saved_globals_length,
  );
};

const checkAsyncEnabled = (exports, asyncState, type) => {
  if (exports.asyncify_start_unwind === undefined) {
    debugger;
    throw new UserError("Tried to use async functionality without running asyncify");
  }
  if (asyncState.type !== 'stop') throw new Error(`invariant broken ${type}`);
  asyncState.type = type;
};

const handleFork = (exports, sys_buf, stack_buf, asyncState) => {
  if (asyncState.type === 'fork') {
    exports.asyncify_stop_rewind();
    asyncState.type = 'stop';
  } else {
    checkAsyncEnabled(exports, asyncState, 'fork');
    asyncState.sys_buf = sys_buf;
    asyncState.stack_buf = stack_buf;
    exports.asyncify_start_unwind(stack_buf);
  }
  return asyncState.pid;
};

const handleLongjmp = (exports, stack_buf, asyncState, restore_buf, retval) => {
  checkAsyncEnabled(exports, asyncState, 'longjmp');
  asyncState.retval = retval;
  asyncState.stack_buf = restore_buf;
  exports.asyncify_start_unwind(stack_buf);
};

const handleSetjmp = (exports, stack_buf, asyncState) => {
  if (asyncState.type === 'setjmp') {
    exports.asyncify_stop_rewind();
    asyncState.type = 'stop';
    return 0;
  } else if (asyncState.type === 'longjmp') {
    exports.asyncify_stop_rewind();
    asyncState.type = 'stop';
    return asyncState.retval;
  } else {
    checkAsyncEnabled(exports, asyncState, 'setjmp');
    asyncState.stack_buf = stack_buf;
    exports.asyncify_start_unwind(stack_buf);
    return 0;
  }
};

// CAUTION: this depends on the user-side implementation of syscalls.
const syscallFork = (module, exports, memory, asyncState) => {
  const {sys_buf, stack_buf} = asyncState;
  exports.asyncify_stop_unwind();
  const syncWord = getSyncWord(memory, sys_buf);
  const dv = new DataView(memory.buffer);
  dv.setUint32(sys_buf + SYSBUF_OFFSET.tag, OSOAP_SYS.TAG.W.fork, true);
  dv.setUint32(sys_buf + SYSBUF_OFFSET.fork.stack_buf, stack_buf, true);
  saveGlobals(module, exports, getSavedGlobalsDataView(dv, sys_buf));
  // send syscall
  const old_state = Atomics.compareExchange(syncWord, 0, OSOAP_SYS.TURN.USER, OSOAP_SYS.TURN.KERNEL);
  if (old_state !== OSOAP_SYS.TURN.USER) {
    return -E.AGAIN; // Should be handled by poll_signals after return.
  }
  Atomics.notify(syncWord, 0, 1);
  Atomics.wait(syncWord, 0, OSOAP_SYS.TURN.KERNEL);
  exports.asyncify_start_rewind(stack_buf);
  // fork is *not* a syscall which can be interrupted by a signal and
  // then restarted.
  asyncState.pid = dv.getBigInt64(sys_buf + SYSBUF_OFFSET.linux_syscall_return, true);
};

const resumeSyscallFork = (module, exports, memory, asyncState) => {
  const {sys_buf, stack_buf} = asyncState;
  const dv = new DataView(memory.buffer);
  /*
   * const syncWord = getSyncWord(memory, sys_buf);
   * // This Atomics.wait is non-essential; the kernel should set
   * // the turn to USER before starting the child process
   * Atomics.wait(syncWord, 0, OSOAP_SYS.TURN.KERNEL);
   */
  restoreGlobals(module, exports, getSavedGlobalsDataView(dv, sys_buf));
  exports.asyncify_start_rewind(stack_buf);
  asyncState.pid = dv.getBigInt64(sys_buf + SYSBUF_OFFSET.linux_syscall_return, true);
};

const runWithAsync = (module, exports, memory, asyncState, call) => {
  while (asyncState.type !== 'stop') {
    if (exports.asyncify_get_state?.() === 2) throw new Error("Shouldn't be rewinding here");
    if (asyncState.type === 'fork') syscallFork(module, exports, memory, asyncState);
    else if (asyncState.type === 'childFork') {
      resumeSyscallFork(module, exports, memory, asyncState);
      asyncState.type = 'fork';
    } else if (asyncState.type === 'setjmp') {
      exports.asyncify_stop_unwind();
      const dv = new DataView(memory.buffer);
      const unwound = dv.getUint32(asyncState.stack_buf, true);
      dv.setUint32(asyncState.stack_buf + 8, unwound, true);
      exports.asyncify_start_rewind(asyncState.stack_buf);
    } else if (asyncState.type === 'longjmp') {
      exports.asyncify_stop_unwind();
      exports.asyncify_start_rewind(asyncState.stack_buf);
    } else if (asyncState.type === 'regular') asyncState.type = 'stop';
    else {
      throw new Error("Unrecognized async type");
    }
    const asyncifyState = exports.asyncify_get_state?.();
    if (asyncifyState === 1) throw new Error("Should have stopped unwinding");
    call();
  }
};

export {handleFork, handleSetjmp, handleLongjmp, runWithAsync};
