const SYSBUF_OFFSET = {
  sync_word: 0,
  flag_word: 4,
  tag: 8,
  linux_syscall: {
    n: 16,
    args: 20,
    cnt: 48,
  },
  linux_syscall_return: 16,
  exit_process_code: 16,
  pid_return: 16,
  fork: {
    stack_buf: 16,
    saved_globals: 20,
    saved_globals_length: 32,
  },
  length: 52,
};

const OSOAP_SYS = {
  TURN: {USER: 0, KERNEL: 1, DETACHED: 2},
  FLAG: {
    SIGNAL: 0x1,
    DEBUGGER: 0x2,
    EXIT: 0x4,
  },
  TAG: {
    W: {
      linux_syscall: 1,
      poll_signals: 3,
      exit_process: 5,
      exit_thread: 7,
      gettid: 9,
      fork: 11,
    },
    R: {
      linux_syscall_return: 2,
      pid_return: 4,
      signal_then_retry: 6,
    },
  },
};

export {SYSBUF_OFFSET, OSOAP_SYS};
