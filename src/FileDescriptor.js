import {E} from './syscall/linux/errno.js';

// Eventually want to make this configurable with ulimit or similar.
const MAX_NUM_FDS = 1 << 16;

class FileDescriptorSpaceExhaustedError extends Error {
  constructor(...args) {
    super(...args);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileDescriptorSpaceExhaustedError);
    }
    this.name = "FileDescriptorSpaceExhaustedError";
    this.linuxSyscallErrno = E.MFILE;
  }
}

class BadFileDescriptorError extends Error {
  constructor(...args) {
    super(...args);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BadFileDescriptorError);
    }
    this.name = "BadFileDescriptorError";
    this.linuxSyscallErrno = E.BADF;
  }
}

class FileDescriptor {
  constructor(openFileDescription, closeOnExec) {
    this.openFileDescription = openFileDescription;
    this.closeOnExec = closeOnExec;
    this.openFileDescription.incRefCount();
  }

  copy({copyForExec = false, closeOnExec} = {}) {
    if (copyForExec && this.closeOnExec) return null;
    this.openFileDescription.incRefCount();
    return new FileDescriptor(this.openFileDescription, closeOnExec ?? this.closeOnExec);
  }

  dispose() {
    this.openFileDescription.decRefCount();
    this.openFileDescription = null;
  }
}

class FileDescriptorTable {
  constructor(fdtableToCopy = undefined, copyForExec = false) {
    // Array<FileDescriptor | null>
    if (fdtableToCopy === undefined) {
      this.array = [null, null, null];
    } else {
      this.array = [];
      for (const fd of fdtableToCopy.array) {
        this.array.push(fd?.copy({copyForExec}) ?? null);
      }
      if (copyForExec) {
        // Reduce the size of the fd array when we exec
        while (this.array.length > 3 && this.array[this.array.length - 1] === null) {
          this.array.pop();
        }
      }
    }
  }

  // A function to allocate the first unused slot in the array
  // The file descriptor returned by thunk should be a new reference.
  // Returns the file descriptor allocated.
  // thunk() returns a new FileDescriptor
  // Throws FileDescriptorSpaceExhaustedError if MAX_NUM_FDS reached.
  allocate(thunk) {
    let ix = this.array.indexOf(null);
    if (ix === -1) {
      ix = this.array.push(null) - 1;
    }
    if (ix >= MAX_NUM_FDS) {
      throw new FileDescriptorSpaceExhaustedError();
    }
    const fd = thunk();
    this.array[ix] = fd;
    return ix;
  }

  // Returns a FileDescriptor
  // Throws BadFileDescriptorError if invalid
  get(i) {
    if (i >= 0 && i < this.array.length) {
      const fd = this.array[i];
      if (fd !== null) return fd;
    }
    throw new BadFileDescriptorError();
  }

  dup(fdi, closeOnExec = false) {
    const fd = this.get(fdi);
    this.allocate(() => fd.copy({closeOnExec}));
  }

  dup2(oldfdi, newfdi, closeOnExec = false) {
    const oldfd = this.get(oldfdi);
    try {
      const newfd = this.get(newfdi);
      this.close(newfd);
    } catch (e) {
      if (!(e instanceof BadFileDescriptorError && newfdi >= 0 && newfdi < 3)) {
        throw e;
      }
      // We don't allow dup2 onto non-open file descriptors
      // other than std{in,out,err}.
      // This is not quite POSIX-correct.
      // TODO: change this to allow dup2 onto arbitrary fds
      // Keep a map of sparse file descriptors, with keys more than
      // this.array.length (maybe + 1).
      // This should be efficiently maintainable.
    }
    this.array[newfdi] = oldfd.copy({closeOnExec});
  }

  // Throws BadFileDescriptorError if invalid
  close(i) {
    const fd = this.get(i);
    // this.get ensures that this.array[i] is valid
    this.array[i] = null;
    fd.dispose();
  }

  tearDown() {
    for (const fd of this.array) fd?.dispose();
    this.array = [];
  }
}

export {
  FileDescriptor,
  FileDescriptorTable,
  FileDescriptorSpaceExhaustedError,
  BadFileDescriptorError,
};
