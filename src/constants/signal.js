// These are mirroring sysroot/include/bits/signal.h
const MINSIGSTKSZ = 2048;
const SIGSTKSZ = 8192;

const SA = {
  NOCLDSTOP: 1,
  NOCLDWAIT: 2,
  SIGINFO: 4,
  ONSTACK: 0x08000000,
  RESTART: 0x10000000,
  NODEFER: 0x40000000,
  RESETHAND: 0x80000000,
};

const SIG = {
  HUP: 1,
  INT: 2,
  QUIT: 3,
  ILL: 4,
  TRAP: 5,
  ABRT: 6,
  IOT: 6,
  BUS: 7,
  FPE: 8,
  KILL: 9,
  USR1: 10,
  SEGV: 11,
  USR2: 12,
  PIPE: 13,
  ALRM: 14,
  TERM: 15,
  STKFLT: 16,
  CHLD: 17,
  CONT: 18,
  STOP: 19,
  TSTP: 20,
  TTIN: 21,
  TTOU: 22,
  URG: 23,
  XCPU: 24,
  XFSZ: 25,
  VTALRM: 26,
  PROF: 27,
  WINCH: 28,
  IO: 29,
  POLL: 29,
  PWR: 30,
  SYS: 31,
};

const SIG_CANT_BE_CAUGHT = new Set([SIG.KILL, SIG.STOP]);

const NSIG = 64;
const SIG_MASK_BYTES = NSIG >> 3;

const SIG_DFL = 0;
const SIG_IGN = -1;
const SIG_ERR = -2;

const SIGACTION_OFFSET = {
  handler: 0,
  flags: 4,
  mask: 8,
  length: 16,
};

export {
  MINSIGSTKSZ,
  SIGSTKSZ,
  SA,
  SIG,
  NSIG,
  SIG_MASK_BYTES,
  SIGACTION_OFFSET,
  SIG_DFL,
  SIG_IGN,
  SIG_ERR,
  SIG_CANT_BE_CAUGHT,
};
