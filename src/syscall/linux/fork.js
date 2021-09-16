import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {E} from './errno.js';
import {SyscallError} from './SyscallError.js';

const fork = (dv, thread) => {
  // Pretend we are the parent
  return thread.process.processId;
};

export {fork};
