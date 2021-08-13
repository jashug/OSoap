import {diagnostic} from './diagnostic.js';
import {oneAtATimeError} from './oneAtATimeError.js';
import {adaptMemory} from './emplaceAdaptiveMemory.js';
import {UserError} from './UserError.js';

class ExitException extends Error {
  constructor(exit_code, ...args) {
    super(...args);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExitException);
    }
    this.name = 'ExitException';
    this.exit_code = exit_code;
  }
}

const runProcess = async (message) => {
  // Either posts an exit message with the exit code, or
  // throws an error.

  // If !(precompiled || create_memory), we could use instantiateStreaming.
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

  // Instantiate
  const imports = {
    diagnostic,
    env: {
      memory,
      register_syscall_buffer: (sys_buf, loc) => {
        postMessage({
          purpose: "register_syscall_buffer",
          compiled_module: module,
          memory,
          sys_buf,
          loc, /* clear_child_tid */
        });
        return tid;
      },
      throw_exit: (ec) => { throw new ExitException(ec); },
    },
  };
  const instance = await WebAssembly.instantiate(module, imports);

  // Run
  try {
    instance.exports._start();
  } catch (e) {
    if (e instanceof ExitException) {
      postMessage({
        purpose: "exit",
        exit_code: e.exit_code,
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
  if (message.purpose === "start") {
    await runProcess(message);
  } else {
    throw new Error(`Unrecognized message purpose ${message.purpose}`);
  }
});
addEventListener("message", handleMessage);
