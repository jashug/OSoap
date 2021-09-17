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

  copy(closeOnExec = false) {
    if (closeOnExec && this.closeOnExec) return null;
    this.openFileDescription.incRefCount();
    return new FileDescriptor(this.openFileDescription, this.closeOnExec);
  }

  dispose() {
    this.openFileDescription.decRefCount();
    this.openFileDescription = null;
  }
}

class FileDescriptorTable {
  constructor(fdtableToCopy = undefined, closeOnExec = false) {
    // Array<FileDescriptor | null>
    if (fdtableToCopy === undefined) {
      this.array = [null, null, null];
    } else {
      this.array = [];
      for (const fd of fdtableToCopy.array) {
        this.array.push(fd?.copy(closeOnExec) ?? null);
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
