import {diagnostic} from './diagnostic.js';
import {oneAtATimeError} from '../oneAtATimeError.js';
import {adaptMemory} from './emplaceAdaptiveMemory.js';
import {UserError} from '../UserError.js';
import {MSG_PURPOSE} from '../constants/messagePurpose.js';
import {handleFork, runWithFork} from './syscallFork.js';

class ExitException extends Error {
  constructor(...args) {
    super(...args);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExitException);
    }
    this.name = 'ExitException';
  }
}

const handleProcessMessage = async (message) => {
  // Either posts an exit message with the exit code, or
  // throws an error.

  // If !(precompiled || createMemory), we could use instantiateStreaming.
  // However, this case is rare to non-existent, so don't optimize for it
  // without further investigation.

  const tid = message.tid;

  // Compile
  let module;
  if (message.context.module instanceof WebAssembly.Module) {
    module = message.context.module;
  } else {
    module = await WebAssembly.compileStreaming(fetch(message.context.module, {
      headers: {'Accept': 'application/wasm'},
    }));
  }

  const memoryLoc = {module: 'env', name: 'memory'};
  const memory = adaptMemory(module, memoryLoc, message.context.memory);

  if (message.context.requestShareModuleAndMemory) {
    postMessage({
      purpose: MSG_PURPOSE.UTK.SHARE_MODULE_AND_MEMORY,
      compiledModule: module,
      memory,
    });
  }

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
        return handleFork(exports, sys_buf, stack_buf, forking);
      },
    },
  };
  const instance = await WebAssembly.instantiate(module, imports);
  const exports = instance.exports;

  // Run
  const forking = message.context.forking;
  try {
    runWithFork(module, exports, memory, forking, () => {
      exports._start();
    });
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
  throw new UserError("Start function returned");
};

const handleMessage = oneAtATimeError(async (e) => {
  const message = e.data;
  if (message.purpose === MSG_PURPOSE.KTU.START) {
    await handleProcessMessage(message);
  } else {
    throw new Error(`Unrecognized message purpose ${message.purpose}`);
  }
});
addEventListener("message", handleMessage);
