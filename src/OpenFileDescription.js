import {NoTTYError} from './syscall/linux/NoTTYError.js';
import {IOCTL} from './constants/ioctl.js';
import {FILE_STATUS_FLAGS} from './constants/fs.js';
/*
// Performs the same purpose as Linux struct file.f_mode
// TODO: Make sure these flags are all useful
class FileMode {
  constructor() {
    this.readable = false;
    this.writable = false;
    this.seekable = false;
    this.executable = false;
    this.mayeagain = false;
  }
}

class FileFlags {
  constructor() {
    this.append = false;
    this.nonblock = false;
    this.dsync = false;
    this.rsync = false;
    this.sync = false;
    this.noatime = false;
  }
}
*/

/* Interface for OpenFileDescription:
 * writev
 * fstat
 *   (virtual file descriptors should still try to put something
 *    unique-ish in st_dev and st_ino)
 *   devices should return the st_dev and st_ino of the file they
 *   were opened from in the filesystem.
 * dispose - called automatically when refCount goes to 0
 * search - looks up a directory entry
 */
class OpenFileDescription {
  constructor(flags = 0) {
    this.refCount = 0;
    this.statusFlags = flags & FILE_STATUS_FLAGS;
  }

  decRefCount() {
    if (this.refCount <= 0) throw new Error("Decrement zero refCount");
    if (--this.refCount === 0) {
      this.dispose();
    }
  }

  incRefCount() {
    if (this.refCount < 0) throw new Error("Increment negative refCount");
    this.refCount++;
  }

  ioctl(request, thread) {
    if (request === IOCTL.TIOC.GWINSZ) {
      // musl uses this for isatty, so matters early.
      throw new NoTTYError();
    } else {
      debugger;
      thread.requestUserDebugger();
      throw new NoTTYError();
    }
  }

  // These support select calls
  readyForReading() {
    return true;
  }

  readyForWriting() {
    return true;
  }

  errorConditionPending() {
    return rejectedReadyPromise;
  }
}

class OpenRegularFileDescription extends OpenFileDescription {
  constructor(flags) {
    super(flags);
    this.offset = 0;
  }
}

const rejectedReadyPromise = Promise.reject(new Error());
rejectedReadyPromise.catch(() => {});

export {
  OpenFileDescription,
  OpenRegularFileDescription,
  rejectedReadyPromise,
};
