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
    this.array = [];
    // Map<int, FileDescriptor>
    this.sparse = new Map();
    // invariant: keys of this.sparse >= this.array.length
    if (fdtableToCopy !== undefined) {
      for (const fd of fdtableToCopy.array) {
        this.array.push(fd?.copy({copyForExec}) ?? null);
      }
      for (const [key, fd] of fdtableToCopy.sparse) {
        const fdCopy = fd.copy({copyForExec});
        if (fdCopy) this.sparse.set(key, fdCopy);
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
  // Returns the file descriptor number allocated.
  // Throws FileDescriptorSpaceExhaustedError if MAX_NUM_FDS reached.
  allocate(fd) {
    let ix = this.array.indexOf(null); // Could be sped up if becomes a performance bottleneck
    if (ix === -1) {
      while (this.sparse.has(this.array.length)) {
        const key = this.array.length;
        this.array.push(this.sparse.get(key));
        this.sparse.delete(key);
      }
      ix = this.array.push(null) - 1;
    }
    if (ix >= MAX_NUM_FDS) {
      fd.dispose();
      throw new FileDescriptorSpaceExhaustedError();
    }
    this.array[ix] = fd;
    return ix;
  }

  // Returns a FileDescriptor
  // Throws BadFileDescriptorError if invalid
  get(i) {
    if (i >= 0 && i < this.array.length) {
      const fd = this.array[i];
      if (fd !== null) return fd;
    } else if (this.sparse.has(i)) {
      return this.sparse.get(i);
    }
    throw new BadFileDescriptorError();
  }

  dup(fdi, closeOnExec = false) {
    const fd = this.get(fdi);
    return this.allocate(fd.copy({closeOnExec}));
  }

  dup2(oldfdi, newfdi, closeOnExec = false) {
    const oldfd = this.get(oldfdi);
    try {
      const newfd = this.get(newfdi);
      this.close(newfd);
    } catch (e) {
      if (!(e instanceof BadFileDescriptorError && newfdi >= 0)) throw e;
      if (newfdi >= this.array.length) {
        this.sparse.set(newfdi, oldfd.copy({closeOnExec}));
        return newfdi;
      }
    }
    this.array[newfdi] = oldfd.copy({closeOnExec});
    return newfdi;
  }

  // Throws BadFileDescriptorError if invalid
  close(i) {
    const fd = this.get(i);
    // this.get ensures that this.array[i] is valid
    if (i === this.array.length - 1) this.array.pop();
    else if (i < this.array.length - 1) this.array[i] = null;
    else this.sparse.delete(i);
    fd.dispose();
  }

  tearDown() {
    for (const fd of this.array) fd?.dispose();
    for (const [, fd] of this.sparse) fd.dispose();
    this.array = [];
  }
}

export {
  FileDescriptor,
  FileDescriptorTable,
  FileDescriptorSpaceExhaustedError,
  BadFileDescriptorError,
  MAX_NUM_FDS,
};
