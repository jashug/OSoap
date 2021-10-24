const exit_process = (sysbuf, thread) => {
  thread.process.exit(sysbuf.exit_process_code);
};

export {exit_process};
