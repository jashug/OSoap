import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';
import {copyCString, pathFromString} from '../../fs/Path.js';
import {resolveToEntry} from '../../fs/resolve.js';
import {LoopError} from '../../fs/errors.js';
import {ExecException} from '../../threadTable.js';

const INTERPRETER_NESTING_DEPTH = 10;

const readListOfStrings = (out, dv, ptr) => {
  while (true) {
    const strPtr = dv.getUint32(ptr, true);
    if (strPtr === 0) break;
    const str = copyCString(dv.buffer, strPtr + dv.byteOffset);
    out.push(str);
    ptr += 4;
  }
};

const getExecutable = async (dv, thread, filename) => {
  let pathname = copyCString(dv.buffer, filename + dv.byteOffset);
  const curdir = thread.process.currentWorkingDirectory;
  const rootdir = thread.process.rootDirectory;
  const args = [];
  for (let i = 0; i < INTERPRETER_NESTING_DEPTH; i++) {
    const path = pathFromString(pathname);
    const result = await resolveToEntry(path, curdir, rootdir, {
      allowEmptyPath: false,
    }, (entry) => {
      return entry.openExecutable(thread);
    });
    if (result.done) {
      args.reverse();
      return {args, module: result.module};
    } else {
      if (result.optarg) args.push(result.optarg);
      args.push(pathname);
      pathname = result.pathname;
    }
  }
  throw new LoopError();
};

const execve = async (dv, thread) => {
  const filename = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const argv = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const envp = dv.getUint32(thread.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  const {args, module} = await getExecutable(dv, thread, filename);
  readListOfStrings(args, dv, argv);
  const environment = [];
  readListOfStrings(environment, dv, envp);
  throw new ExecException(module, args, environment);
};

export {execve};
