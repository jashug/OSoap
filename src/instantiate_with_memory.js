// Add a Memory object of the shape declared in module to importObj at {namespace: str, name: str},
// and return {instance: Instance, memory: Memory}
// This ought to be as simple as
// WebAssembly.instantiate(
//   module,
//   Object.assign(
//     importObj,
//     {namespace: {name:
//       WebAssembly.Memory(
//         findByPath(WebAssembly.Module.imports(module), memoryPath)
//         .limits
//     }}
//   )
// )
// But lacking a limits field in the imports list (or an equivalent way of getting the data)
// I am reduced to tracking the limits out of band or munging LinkError.message.
// Here we munge error messages (for Chrome specifically).

const initialTooSmall = 'WebAssembly.instantiate(): memory import 0 is smaller than initial ';
const noMaximum = 'WebAssembly.instantiate(): memory import 0 has no maximum limit';
const maximumTooLarge = 'WebAssembly.instantiate(): memory import 0 has a larger maximum size 65536 than the module\'s declared maximum ';
const notShared = 'WebAssembly.instantiate(): mismatch in shared state of memory, declared = 1, imported = 0'

const STATE_NO_KNOWLEDGE = 0;
const STATE_CORRECT_INITIAL = 1;
const STATE_CORRECT_INITIAL_NEEDS_MAXIMUM = 2;
const STATE_CORRECT_INITIAL_MAXIMUM = 3;
const STATE_CORRECT_INITIAL_MAXIMUM_NEEDS_SHARED = 4;
const STATE_FINAL_ANSWER = STATE_CORRECT_INITIAL_MAXIMUM_NEEDS_SHARED;

const MAX_MAXIMUM = 65536;

// When the error messages don't match what we expected, throw an error to bail out.
class UnexpectedStateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnexpectedStateError';
  }
}

const instantiateWithMemory = async (module, importObj, {namespace, name}) => {
  const memoryDescriptor = {initial: 0};
  let instance = null;
  let memory = null;
  let state = STATE_NO_KNOWLEDGE;
  const advanceState = (newState) => {
    if (newState <= state) throw new UnexpectedStateError(`${newState} <= ${state}`);
    state = newState;
  };
  while (true) {
    memory = new WebAssembly.Memory(memoryDescriptor);
    importObj[namespace][name] = memory;
    try {
      return {instance: await WebAssembly.instantiate(module, importObj), memory};
    } catch(e) {
      if (state == STATE_FINAL_ANSWER) throw e;
      if (!(e instanceof WebAssembly.LinkError)) throw e;
      if (e.message.startsWith(initialTooSmall)) {
        const endpoint = e.message.search(/,/g);
        if (endpoint == -1) throw e;
        memoryDescriptor.initial = parseInt(e.message.substring(initialTooSmall.length, endpoint));
        advanceState(STATE_CORRECT_INITIAL);
      } else if (e.message.startsWith(noMaximum)) {
        memoryDescriptor.maximum = MAX_MAXIMUM;
        advanceState(STATE_CORRECT_INITIAL_NEEDS_MAXIMUM);
      } else if (e.message.startsWith(maximumTooLarge)) {
        memoryDescriptor.maximum = parseInt(e.message.substring(maximumTooLarge.length));
        advanceState(STATE_CORRECT_INITIAL_MAXIMUM);
      } else if (e.message.startsWith(notShared)) {
        memoryDescriptor.shared = true;
        advanceState(STATE_CORRECT_INITIAL_MAXIMUM_NEEDS_SHARED);
      } else {
        throw e;
      }
    }
  }
};

export {instantiateWithMemory};
