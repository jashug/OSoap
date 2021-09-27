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

const stringArraySize = (strings) => {
  let size = 4 * (strings.length + 1);
  for (const bytes of strings) {
    size += bytes.length + 1;
  }
  return size;
};

const writeStringArray = (strings, buffer, ptr) => {
  const uint8array = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  let stringPtr = ptr + 4 * (strings.length + 1);
  for (const bytes of strings) {
    uint8array.set(bytes, stringPtr);
    dv.setUint8(stringPtr + bytes.length, 0, true);
    dv.setUint32(ptr, stringPtr, true);
    stringPtr += bytes.length + 1;
    ptr += 4;
  }
  dv.setUint32(ptr, 0, true);
  return strings.length;
};

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

  let initialEnvironment = message.context.environment;
  let initialArguments = message.context.arguments;

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
      environment_size: () => stringArraySize(initialEnvironment),
      fill_environment: (ptr) => {
        writeStringArray(initialEnvironment, memory.buffer, ptr);
        initialEnvironment = null; // Drop reference to the environment
      },
      argv_size: () => stringArraySize(initialArguments),
      fill_argv: (ptr) => {
        const argc = writeStringArray(initialArguments, memory.buffer, ptr);
        initialArguments = null;
        return argc;
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
