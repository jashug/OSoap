import {IOCTL} from './constants/ioctl.js';
import {O, FILE_STATUS_FLAGS} from './constants/fs.js';
import {NotADirectoryError, IsADirectoryError, SocketOrPipeError} from './fs/errors.js';
import {NoTTYError} from './syscall/linux/NoTTYError.js';
import {InvalidError} from './syscall/linux/InvalidError.js';
import {OverflowError} from './syscall/linux/OverflowError.js';

class OpenFileDescription {
  constructor(flags) {
    this.fileLoc = null;
    this.refCount = 0;
    this.statusFlags = flags;
    this.accessMode = flags & O.ACCMODE;
  }

  set statusFlags(rhs) {
    this._statusFlags = rhs & FILE_STATUS_FLAGS;
  }

  get statusFlags() { return this._statusFlags; }

  decRefCount() {
    if (this.refCount <= 0) throw new Error("Decrement zero refCount");
    if (--this.refCount === 0) {
      this.dispose();
      this.fileLoc.decRefCount();
    }
  }

  incRefCount() {
    if (this.refCount < 0) throw new Error("Increment negative refCount");
    this.refCount++;
  }

  dispose() {}

  ioctl(request, argp, dv, thread) {
    if (request === IOCTL.TIOC.GWINSZ) {
      // musl uses this for isatty, so matters early.
      throw new NoTTYError();
    } else {
      debugger;
      thread.requestUserDebugger();
      throw new NoTTYError();
    }
  }

  // TODO: maybe perform permission checking at this level, and move the implementation to {readv,writev}Impl methods
  writev() { throw new Error("unimplemented writev"); }
  readv() { throw new Error("unimplemented readv"); }

  lseek() { throw new SocketOrPipeError(); }

  readDirEntry() { throw new NotADirectoryError(); }

  // These support select calls
  readyForReading() {
    return true;
  }

  readyForWriting() {
    return true;
  }

  errorConditionPending() {
    return false;
  }

  get fileType() { return this.fileLoc.fileType; }
  get mount() { return this.fileLoc.mount; }
  get id() { return this.fileLoc.id; }

  // Account for the permissions a file was opened with, including search
  search(...args) { return this.fileLoc.search(...args); }
  parentDirectory(...args) { return this.fileLoc.parentDirectory(...args); }
  openExisting(...args) { return this.fileLoc.openExisting(...args); }
  openExecutable(...args) { return this.fileLoc.openExecutable(...args); }
  stat(...args) { return this.fileLoc.stat(...args); }
  access(...args) { return this.fileLoc.access(...args); }
  readlink(...args) { return this.fileLoc.readlink(...args); }
}

class OpenRegularFileDescription extends OpenFileDescription {
  constructor(flags) {
    super(flags);
    this.offset = 0;
  }

  setOffsetChecked_(offset) {
    if (offset < 0) throw new InvalidError();
    if (offset > Number.MAX_SAFE_INTEGER) throw new OverflowError();
    this.offset = offset;
    return this.offset;
  }
}

class OpenDirectoryDescription extends OpenFileDescription {
  constructor(flags) {
    if (flags & O.WRITE) throw new IsADirectoryError();
    super(flags);
    this.offset = 0;
  }

  readv() { throw new IsADirectoryError(); }

  readDirEntry() {
    throw new Error("subclass must implement");
  }

  setOffsetChecked_(offset) {
    if (offset < 0) throw new InvalidError();
    if (offset > Number.MAX_SAFE_INTEGER) throw new OverflowError();
    this.offset = offset;
    return this.offset;
  }
}

class OpenDeviceDescription extends OpenFileDescription {
}

class OpenFIFODescription extends OpenFileDescription {
}

class OpenSocketDescription extends OpenFileDescription {
}

export {
  OpenFileDescription,
  OpenRegularFileDescription,
  OpenDirectoryDescription,
  OpenDeviceDescription,
  OpenFIFODescription,
  OpenSocketDescription,
};
