import {diagnostic} from './diagnostic.js';

// Takes an async function f and wraps f so that it is an error to call interleaved.
const oneAtATimeError = (f) => {
  let busy = false;
  return async (...args) => {
    if (busy) { throw new Error("Called twice interleaved"); }
    busy = true;
    try {
      return f(...args);
    } finally {
      busy = false;
    }
  };
};

const castImportToMemory = ({module, name, kind, type}) => {
  if (kind !== "memory") {
    throw new Error(`import ${module}.${name} has kind ${kind} expected memory`);
  }
  // Chrome does not currently report shared memory status.
  /*
  if (type.shared !== true) {
    throw new Error(`import ${module}.${name} is not shared memory`);
  }
  */
  return new WebAssembly.Memory({...type, shared: true});
};

const importLocationEq = (lhs, rhs) => {
  return lhs.module === rhs.module && lhs.name === rhs.name;
};

const emplaceImport = (imports, {module, name}, value) => {
  if (imports[module] === undefined) imports[module] = {};
  if (imports[module][name] === undefined) {
    imports[module][name] = value;
  } else {
    throw new Error(`import ${module}.${name} already defined`);
  }
};

const runProcess = async (message) => {
  // If !(precompiled || create_memory), we could use instantiateStreaming.
  // However, this case is rare to non-existent, so don't optimize for it
  // without further investigation.

  // Compile
  let module;
  if (message.module instanceof WebAssembly.Module) {
    module = message.module;
  } else {
    module = await WebAssembly.compileStreaming(fetch(message.module));
  }

  // Define Memory import
  const memorySpec = message.memory;
  let memory;
  // Consider defaulting to {module: "env", name: "memory"}
  if (memorySpec.memory === undefined) {
    const imports = WebAssembly.Module.imports(module);
    for (const importSpec of imports){
      if (importLocationEq(importSpec, memorySpec)) {
        memory = castImportToMemory(importSpec);
        break;
      }
    }
    if (memory === undefined) {
      const module = memorySpec.module;
      const name = memorySpec.name;
      throw new Error(`import ${module}.${name} not found (memory)`);
    }
  } else {
    memory = memorySpec.memory;
  }

  // Instantiate
  const imports = {
    diagnostic,
  };
  emplaceImport(imports, memorySpec, memory);
  const instance = await WebAssembly.instantiate(module, imports);

  // Run
  instance.exports._start();
};

const handleMessage = oneAtATimeError(async (e) => {
  const message = e.data;
  if (message.purpose === "process") {
    await runProcess(message);
  } else {
    throw new Error(`Unrecognized message purpose ${message.purpose}`);
  }
});
addEventListener("message", handleMessage);
