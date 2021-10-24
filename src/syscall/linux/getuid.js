const getuid = (sysbuf, thread) => {
  return thread.process.setUserId.real;
};

const geteuid = (sysbuf, thread) => {
  return thread.process.setUserId.effective;
};

const getgid = (sysbuf, thread) => {
  return thread.process.setGroupId.real;
};

const getegid = (sysbuf, thread) => {
  return thread.process.setGroupId.effective;
};

export {getuid, geteuid, getgid, getegid};
