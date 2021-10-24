const SYSBUF_OFFSET = {
  sync_word: 0,
  flag_word: 4,
  tag: 8,
  linux_syscall: {
    n: 16,
    cnt: 20,
    args: 24,
  },
  linux_syscall_return: 16,
  exit_process_code: 16,
  fork: {
    stack_buf: 16,
    saved_globals: 20,
    saved_globals_length: 60,
  },
  length: 80,
};

// TODO: extend syscall interface to allow more flexible
// control of errno
// This could look like a field in sys_buf that the user
// sets to zero beforehand, then sets errno to that value
// if it comes back non-zero.

const OSOAP_SYS = {
  TURN: {USER: 0, KERNEL: 1, DETACHED: 2},
  FLAG: {
    SIGNAL: 0x1,
    DEBUGGER: 0x2,
  },
  TAG: {
    W: {
      linux_syscall: 1,
      poll_signals: 3,
      exit_process: 5,
      exit_thread: 7,
      fork: 9,
    },
    R: {
      unknown_syscall: 0,
      linux_syscall_return: 2,
      signal_then_retry: 4,
    },
  },
};

export {SYSBUF_OFFSET, OSOAP_SYS};
