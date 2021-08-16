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
  detach_exit_code: 16,
};

const OSOAP_SYS = {
  TURN: {USER: 0, KERNEL: 1},
  FLAG: {
    SIGNAL: 0x1,
    DEBUGGER: 0x2,
    DIE: 0x4,
  },
  TAG: {
    W: {
      linux_syscall: 1,
      detach: 3,
    },
    R: {
      linux_syscall_return: 2,
      unknown_syscall: 4,
    },
  },
};

export {SYSBUF_OFFSET, OSOAP_SYS};
