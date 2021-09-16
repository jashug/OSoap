import {diagnostic} from './diagnostic.js';
import {oneAtATimeError} from '../oneAtATimeError.js';
import {adaptMemory} from './emplaceAdaptiveMemory.js';
import {UserError} from '../UserError.js';
import {MSG_PURPOSE} from '../constants/messagePurpose.js';
import {E} from '../syscall/linux/errno.js';
import {syscallFork} from './syscallFork.js';

class ExitException extends Error {
  constructor(...args) {
    super(...args);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExitException);
    }
    this.name = 'ExitException';
  }
}

const runProcess = async (message) => {
  // Either posts an exit message with the exit code, or
  // throws an error.

  // If !(precompiled || createMemory), we could use instantiateStreaming.
  // However, this case is rare to non-existent, so don't optimize for it
  // without further investigation.

  const tid = message.tid;

  // Compile
  let module;
  if (message.module instanceof WebAssembly.Module) {
    module = message.module;
  } else {
    module = await WebAssembly.compileStreaming(fetch(message.module));
  }

  const memoryLoc = {module: 'env', name: 'memory'};
  const memory = adaptMemory(module, memoryLoc, message.memory);

  postMessage({
    purpose: MSG_PURPOSE.UTK.SHARE_MODULE_AND_MEMORY,
    compiledModule: module,
    memory,
  });

  // Instantiate
  const imports = {
    diagnostic,
    env: {
      memory,
      register_syscall_buffer: (sysBuf, loc) => {
        postMessage({
          purpose: MSG_PURPOSE.UTK.REGISTER_SYSBUF,
          sysBuf,
          loc, /* clear_child_tid */
        });
        return tid;
      },
      throw_exit: () => { throw new ExitException(); },
      fork: (sys_buf, stack_buf) => {
        if (forking === null) {
          if (instance.exports.asyncify_start_unwind === undefined) {
            return -E.NOSYS;
          }
          // Start unwinding the stack to fork
          instance.exports.asyncify_start_unwind(stack_buf);
          forking = {sys_buf, stack_buf, pid: -1};
          return forking.pid;
        } else {
          instance.exports.asyncify_stop_rewind();
          const pid = forking.pid;
          forking = null;
          return pid;
        }
      },
    },
  };
  const instance = await WebAssembly.instantiate(module, imports);

  // Run
  let forking = null;
  while (true) {
    try {
      instance.exports._start();
    } catch (e) {
      if (e instanceof ExitException) {
        postMessage({
          purpose: MSG_PURPOSE.UTK.EXIT,
        });
        return;
      } else {
        throw e;
      }
    }
    if (forking === null) throw new UserError("Start function returned");
    else {
      instance.exports.asyncify_stop_unwind();
      forking.pid = syscallFork(memory, forking.sys_buf);
      instance.exports.asyncify_start_rewind(forking.stack_buf);
    }
  }
};

const handleMessage = oneAtATimeError(async (e) => {
  const message = e.data;
  if (message.purpose === MSG_PURPOSE.KTU.START) {
    await runProcess(message);
  } else {
    throw new Error(`Unrecognized message purpose ${message.purpose}`);
  }
});
addEventListener("message", handleMessage);
