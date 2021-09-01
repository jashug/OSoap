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
  exit_thread_return_value: 16,
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
      exit_process: 3,
      exit_thread: 7, // TODO: renumber
      poll_signals: 5,
    },
    R: {
      linux_syscall_return: 2,
      unknown_syscall: 4,
      signal_then_retry: 6,
    },
  },
};

export {SYSBUF_OFFSET, OSOAP_SYS};
