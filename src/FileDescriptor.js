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
  }
}

class FileDescriptorTable {
  constructor(predefinedFileDescriptors = []) {
    // Array<FileDescriptor | null>
    this.array = [...predefinedFileDescriptors];
    for (const fd of this.array) {
      fd.openFileDescription.incRefCount();
    }
  }

  // A function to allocate the first unused slot in the array
  // Increments the reference count of the open file description stored.
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
    fd.openFileDescription.incRefCount();
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
    fd.openFileDescription.decRefCount();
  }

  tearDown() {
    for (const fd of this.array) {
      if (fd === null) continue;
      fd.openFileDescription.decRefCount();
    }
    this.array = [];
  }
}

export {
  FileDescriptor,
  FileDescriptorTable,
  FileDescriptorSpaceExhaustedError,
  BadFileDescriptorError,
};
