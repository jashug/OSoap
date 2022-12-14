import {SyscallError} from '../syscall/linux/SyscallError.js';
import {E} from '../syscall/linux/errno.js';

const HEADER_SIZE = 256;

const compareMagic = (bytes, template) => {
  if (bytes.length < template.length) return false;
  for (let i = 0; i < template.length; i++) {
    if (bytes[i] !== template[i]) return false;
  }
  return true;
};

const parseShebang = (bytes) => {
  debugger;
  void bytes;
  throw new SyscallError(E.NOEXEC);
  // return {done: false, optarg: null, pathname: null}
};

const wasmHeader = new Uint8Array([0x00, 0x61, 0x73, 0x6D]); // \0asm
const shebangHeader = new Uint8Array([0x23, 0x21]); // #!

const compileWasm = async (backingArray) => {
  try {
    return await WebAssembly.compile(backingArray);
  } catch (e) {
    if (e instanceof WebAssembly.CompileError) throw new SyscallError(E.NOEXEC);
    else throw e;
  }
};

const executableFromUint8Array = async (array) => {
  if (compareMagic(array, wasmHeader)) return {done: true, module: await compileWasm(array)};
  if (compareMagic(array, shebangHeader)) return parseShebang(array);
  throw new SyscallError(E.NOEXEC);
};

// TODO: since compile needs an arraybuffer not a blob, maybe simplest to just go from ArrayBuffer directly.
const executableFromBlob = async (blob) => {
  const headerBytes = new Uint8Array(await blob.slice(0, Math.min(blob.size, HEADER_SIZE)).arrayBuffer());
  if (compareMagic(headerBytes, wasmHeader)) return {done: true, module: await compileWasm(await blob.arrayBuffer())};
  if (compareMagic(headerBytes, shebangHeader)) return parseShebang(headerBytes);
  throw new SyscallError(E.NOEXEC);
};

export {executableFromUint8Array, executableFromBlob};
