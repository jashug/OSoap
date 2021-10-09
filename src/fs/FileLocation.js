import {FMT, O} from '../constants/fs.js';
import {SyscallError} from '../syscall/linux/SyscallError.js';
import {E} from '../syscall/linux/errno.js';
import {InvalidError} from '../syscall/linux/InvalidError.js';

// Immutable: doesn't get moved around.
// Holds a virtual link in to the file.
// File type {regular, directory, symlink, ...} should be known
// but is not tracked here. Use subclasses.
// Starts with a single refCount.
class FileLocation {
  constructor(mount, id) {
    this.mount = mount;
    this.id = id;
    this.refCount = 1;
    this.mount.incRef(this.id);
  }

  incRefCount() {
    this.refCount += 1;
  }

  decRefCount() {
    if (--this.refCount === 0) this.dispose();
  }

  // Always call dispose exactly once
  dispose() {
    this.mount.decRef(this.id);
    this.mount = null;
  }

  stat(...args) {
    return this.mount.fs.stat(this.id, ...args);
  }

  access(...args) {
    return this.mount.fs.access(this.id, ...args);
  }

  openExisting(flags, thread) {
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }
}

const search = async (mount, id, component) => {
  let {id: childId, fmt: childFmt} = await mount.fs.search(id, component);
  let childMount = mount.children.get(childId);
  while (childMount) {
    mount = childMount;
    childId = childMount.bindRoot;
    childMount = mount.children.get(childId);
  }
  return makeFileLocation(mount, childId, childFmt);
};

const parentDirectory = async (mount, id) => {
  while (id === mount.bindRoot) {
    if (mount.parent === null) {
      // The absolute root, which we don't allow mounting on top of.
      return new DirectoryLocation(mount, id);
    }
    id = mount.mountPoint;
    mount = mount.parent;
  }
  return new DirectoryLocation(mount, await mount.fs.parentDirectory(id));
};

class DirectoryLocation extends FileLocation {
  constructor(...args) {
    super(...args);
    this.fileType = FMT.DIRECTORY;
  }

  search(...args) {
    return search(this.mount, this.id, ...args);
  }

  parentDirectory(...args) {
    return parentDirectory(this.mount, this.id, ...args);
  }

  openExisting(flags, thread) {
    if (flags & O.WRITE) throw new SyscallError(E.ISDIR);
    // TODO: opening directories
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }
}

class RegularFileLocation extends FileLocation {
  constructor(...args) {
    super(...args);
    this.fileType = FMT.REGULAR;
  }

  openExisting(...args) {
    return this.mount.fs.openExistingRegular(this.id, ...args);
  }
}

class SymlinkLocation extends FileLocation {
  constructor(...args) {
    super(...args);
    this.fileType = FMT.SYMLINK;
  }
}

class DeviceLocation extends FileLocation {
  constructor(...args) {
    super(...args);
    this.fileType = FMT.DEVICE;
  }

  openExisting(...args) {
    return this.mount.fs.openExistingDevice(this.id, ...args);
  }
}

class FIFOLocation extends FileLocation {
  constructor(...args) {
    super(...args);
    this.fileType = FMT.FIFO;
  }
}

class SocketLocation extends FileLocation {
  constructor(...args) {
    super(...args);
    this.fileType = FMT.SOCKET;
  }
}

const FileLocationTypes = new Map([
  [FMT.REGULAR, RegularFileLocation],
  [FMT.DIRECTORY, DirectoryLocation],
  [FMT.SYMLINK, SymlinkLocation],
  [FMT.DEVICE, DeviceLocation],
  [FMT.FIFO, FIFOLocation],
  [FMT.SOCKET, SocketLocation],
]);

const makeFileLocation = (mount, id, fmt) => {
  const FileLocationFmt = FileLocationTypes.get(fmt);
  return new FileLocationFmt(mount, id);
};

export {
  DirectoryLocation,
  RegularFileLocation,
  SymlinkLocation,
  DeviceLocation,
  FIFOLocation,
  SocketLocation,
  makeFileLocation,
};
