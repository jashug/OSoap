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

// TODO: since compile needs an arraybuffer not a blob, maybe simplest to just go from ArrayBuffer directly.
const executableFromBlob = async (blob) => {
  const headerBytes = new Uint8Array(await blob.slice(0, Math.min(blob.size, HEADER_SIZE)).arrayBuffer());
  if (compareMagic(headerBytes, wasmHeader)) return {done: true, module: await WebAssembly.compile(await blob.arrayBuffer())};
  if (compareMagic(headerBytes, shebangHeader)) return parseShebang(headerBytes);
  throw new SyscallError(E.NOEXEC);
};

export {executableFromBlob};
