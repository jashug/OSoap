const getuid = (dv, thread) => {
  return thread.process.setUserId.real;
};

const geteuid = (dv, thread) => {
  return thread.process.setUserId.effective;
};

const getgid = (dv, thread) => {
  return thread.process.setGroupId.real;
};

const getegid = (dv, thread) => {
  return thread.process.setGroupId.effective;
};

export {getuid, geteuid, getgid, getegid};
