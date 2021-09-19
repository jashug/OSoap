const diagnostic = {
  log_syscall: (syscall_num) => {
    console.log(`Syscall ${syscall_num}`);
  },
  log_i32: (num) => {
    console.log(`WASM: ${num}/0x${num.toString(16)}`);
  },
  debugger: () => { debugger; },
};

export {diagnostic};
