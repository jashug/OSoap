import {SYSBUF_OFFSET} from '../constants/syscallBufferLayout.js';

class LinuxSyscallArg {
  constructor(dv, addr) {
    this.dv = dv;
    this.addr = addr;
  }

  getUint32() {
    return this.dv.getUint32(this.addr, true);
  }

  getInt32() {
    return this.dv.getInt32(this.addr, true);
  }

  getUint64() {
    return this.dv.getBigUint64(this.addr, true);
  }

  getInt64() {
    return this.dv.getBigInt64(this.addr, true);
  }
}
LinuxSyscallArg.prototype.getFd = LinuxSyscallArg.prototype.getInt32;
LinuxSyscallArg.prototype.getPtr = LinuxSyscallArg.prototype.getUint32;
LinuxSyscallArg.prototype.getPid = LinuxSyscallArg.prototype.getInt64;

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
  linuxSyscallArg(i) { return new LinuxSyscallArg(this.dv, this.addr + SYSBUF_OFFSET.linux_syscall.args + 8 * i); }
  set linux_syscall_return(rhs) { this.dv.setBigUint64(this.addr + SYSBUF_OFFSET.linux_syscall_return, BigInt(rhs), true); }
  get exit_process_code() { return this.dv.getInt32(this.addr + SYSBUF_OFFSET.exit_process_code, true); }
  get fork_stack_buf() { return this.dv.getUint32(this.addr + SYSBUF_OFFSET.fork.stack_buf, true); }

  subUint8Array(offset, count) {
    return new Uint8Array(this.dv.buffer, this.dv.byteOffset + offset, count);
  }
}

// TODO: consider a getPath accessor that replaces most uses of pathFromCString

export {
  SyscallBuffer,
};
