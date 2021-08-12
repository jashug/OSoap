import {importLocationEq, emplaceImport} from './wasmImportManagement.js';
import {UserError} from './UserError.js';

const castImportToMemory = ({module, name, kind, type}) => {
  if (kind !== 'memory') {
    throw new UserError(`import ${module}.${name} has kind ${kind} expected memory`);
  }
  // Chrome does not currently report shared memory status
  return new WebAssembly.Memory({...type, shared: true});
};

const adaptMemory = (module, memoryLoc, memory) => {
  if (memory !== undefined) return memory;
  const imports  = WebAssembly.Module.imports(module);
  for (const importSpec of imports) {
    if (importLocationEq(importSpec, memoryLoc)) {
      return castImportToMemory(importSpec);
    }
  }
  const moduleId = memoryLoc.module;
  const name = memoryLoc.name;
  throw new Error(`import ${moduleId}.${name} not found (memory)`);
};

const emplaceAdaptiveMemory = (imports, memoryLoc, memory, module) => {
  const memory_real = adaptMemory(module, memoryLoc, memory);
  emplaceImport(imports, memoryLoc, memory_real);
  return memory_real;
};

export {adaptMemory, emplaceAdaptiveMemory};
