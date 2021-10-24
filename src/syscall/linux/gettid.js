const gettid = (sysbuf, thread) => {
  return thread.threadId;
}

const getpid = (sysbuf, thread) => {
  return thread.process.processId;
};

const getppid = (sysbuf, thread) => {
  return thread.process.parentProcessId;
};

export {gettid, getpid, getppid};
