import {SYSBUF_OFFSET, OSOAP_SYS} from '../constants/syscallBufferLayout.js';
import {E} from '../syscall/linux/errno.js';

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

const handleFork = (exports, sys_buf, stack_buf, forking) => {
  if (forking.inFork) {
    exports.asyncify_stop_rewind();
    forking.inFork = false;
  } else {
    if (exports.asyncify_start_unwind === undefined) {
      throw new Error("Tried to fork without being asyncified");
    }
    forking.sys_buf = sys_buf;
    forking.stack_buf = stack_buf;
    forking.inFork = true;
    exports.asyncify_start_unwind(stack_buf);
  }
  return forking.pid;
};

// CAUTION: this depends on the user-side implementation of syscalls.
const syscallFork = (module, exports, memory, forking) => {
  const {sys_buf, stack_buf} = forking;
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
  forking.pid = dv.getInt32(sys_buf + SYSBUF_OFFSET.pid_return, true);
};

const resumeSyscallFork = (module, exports, memory, forking) => {
  const {sys_buf, stack_buf} = forking;
  const syncWord = getSyncWord(memory, sys_buf);
  const dv = new DataView(memory.buffer);
  // This Atomics.wait is non-essential; the kernel should set
  // the turn to USER before starting the child process
  Atomics.wait(syncWord, 0, OSOAP_SYS.TURN.KERNEL);
  restoreGlobals(module, exports, getSavedGlobalsDataView(dv, sys_buf));
  exports.asyncify_start_rewind(stack_buf);
  forking.pid = dv.getInt32(sys_buf + SYSBUF_OFFSET.pid_return, true);
};

const runWithFork = (module, exports, memory, forking, call) => {
  if (forking.inFork) {
    resumeSyscallFork(module, exports, memory, forking);
  }
  call();
  while (forking.inFork) {
    syscallFork(module, exports, memory, forking);
    call();
  }
};

export {handleFork, runWithFork};
