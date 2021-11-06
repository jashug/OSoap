import {InvalidError} from './InvalidError.js';
import {O} from '../../constants/fs.js';
import {FileDescriptor} from '../../FileDescriptor.js';
import {makePipe} from '../../fs/Pipe.js';

const ALLOWED_PIPE_FLAGS = (
  O.CLOEXEC |
0);

const doPipe = (fds, flags, thread) => {
  // TODO: check error conditions to make sure we don't end up with half a pipe left open
  // For example, what happens if we have space for only one more file descriptor?
  const closeOnExec = Boolean(flags & O.CLOEXEC);
  const [readEnd, writeEnd] = makePipe({nonblocking: Boolean(flags & O.NONBLOCK)}, thread);
  const readFd = thread.process.fdtable.allocate(new FileDescriptor(readEnd, closeOnExec));
  const writeFd = thread.process.fdtable.allocate(new FileDescriptor(writeEnd, closeOnExec));
  fds[0] = readFd;
  fds[1] = writeFd;
  return 0;
};

const pipe = (sysbuf, thread) => {
  const fdptr = sysbuf.linuxSyscallArg(0).getPtr();
  const fds = new Uint32Array(sysbuf.buffer, sysbuf.byteOffset + fdptr, 2);
  return doPipe(fds, 0, thread);
};

const pipe2 = (sysbuf, thread) => {
  const fdptr = sysbuf.linuxSyscallArg(0).getPtr();
  const flags = sysbuf.linuxSyscallArg(1).getInt32();
  const fds = new Uint32Array(sysbuf.buffer, sysbuf.byteOffset + fdptr, 2);
  if (flags & ~ALLOWED_PIPE_FLAGS) throw new InvalidError();
  return doPipe(fds, flags, thread);
};

export {pipe, pipe2};
