const littleEndian = (() => {
  var a = new ArrayBuffer(4);
  var b = new Uint8Array(a);
  var c = new Uint32Array(a);
  b[0] = 0xa1;
  b[1] = 0xb2;
  b[2] = 0xc3;
  b[3] = 0xd4;
  if(c[0] === 0xd4c3b2a1) return true;
  if(c[0] === 0xa1b2c3d4) return false;
  else throw new Error("Unexpected endianness");
})();

if (!littleEndian) throw new Error("Must run on little-endian hardware so that atomic operations agree. To lift this restriction, change the handling of atomic loads, stores, and waits for the syscall interface");
