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
};

export {SYSBUF_OFFSET};
