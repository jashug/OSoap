import {SYSBUF_OFFSET} from '../constants/syscallBufferLayout.js';

class SyscallBuffer {
  constructor(buffer, sysBufAddr) {
    this.dv = new DataView(buffer);
    this.addr = sysBufAddr;
  }

  get buffer() { return this.dv.buffer; }
  get byteOffset() { return this.dv.byteOffset; }
  get byteLength() { return this.dv.byteLength; }

  setSyncWord(value, {yesIKnowThisDoesntNotifyUser = false} = {}) {
    if (!yesIKnowThisDoesntNotifyUser) throw new Error("Misuse of SyscallBuffer.setSyncWord");
    this.dv.setInt32(this.addr + SYSBUF_OFFSET.sync_word, value, true);
  }
  get tag() { return this.dv.getUint32(this.addr + SYSBUF_OFFSET.tag, true); }
  set tag(rhs) { this.dv.setUint32(this.addr + SYSBUF_OFFSET.tag, rhs, true); }

  get linux_syscall_n() { return this.dv.getInt32(this.addr + SYSBUF_OFFSET.linux_syscall.n, true); }
  linuxSyscallArg(i) { return {dv: this.dv, addr: this.addr + SYSBUF_OFFSET.linux_syscall.args + 8 * i}; }
  set linux_syscall_return(rhs) { this.dv.setBigUint64(this.addr + SYSBUF_OFFSET.linux_syscall_return, BigInt(rhs), true); }
  get exit_process_code() { return this.dv.getInt32(this.addr + SYSBUF_OFFSET.exit_process_code, true); }
  get fork_stack_buf() { return this.dv.getUint32(this.addr + SYSBUF_OFFSET.fork.stack_buf, true); }

  subUint8Array(offset, count) {
    return new Uint8Array(this.dv.buffer, this.dv.byteOffset + offset, count);
  }
}

const getUint32 = ({dv, addr}) => {
  return dv.getUint32(addr, true);
};

const getInt32 = ({dv, addr}) => {
  return dv.getInt32(addr, true);
};

const getInt64 = ({dv, addr}) => {
  return dv.getBigInt64(addr, true);
};

const getUint64 = ({dv, addr}) => {
  return dv.getBigUint64(addr, true);
};

const getFd = getInt32;
const getPtr = getUint32;
const getPid = getInt64;

// TODO: consider a getPath accessor that replaces most uses of pathFromCString

export {
  SyscallBuffer,
  getUint32,
  getInt32,
  getInt64,
  getUint64,
  getFd,
  getPtr,
  getPid,
};
