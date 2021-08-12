const diagnostic = {
  log_syscall: (syscall_num) => {
    console.log(`Syscall ${syscall_num}`);
  },
  debugger: () => { debugger; },
};

export {diagnostic};
