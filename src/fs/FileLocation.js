import {FMT, O} from '../constants/fs.js';
import {InvalidError} from '../syscall/linux/InvalidError.js';
import {AccessError, NotADirectoryError, IsADirectoryError} from './errors.js';

const equalFileLocations = (lhs, rhs) => {
  return lhs.mount === rhs.mount && lhs.id === rhs.id;
};

// Immutable: doesn't get moved around.
// Holds a virtual link in to the file.
// File type {regular, directory, symlink, ...} should be known
// but is not tracked here. Use subclasses.
// Starts with a single refCount.
class FileLocation {
  constructor(mount, id) {
    if (mount === null) throw new Error("mount should be non-null");
    this.mount = mount;
    this.id = id;
    this.refCount = 1;
    this.mount.incRef(this.id);
  }

  incRefCount() {
    this.refCount += 1;
    return this;
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

  search() {
    throw new NotADirectoryError();
  }

  parentDirectory() {
    throw new NotADirectoryError();
  }

  unlink() {
    throw new NotADirectoryError();
  }

  rmdir() {
    throw new NotADirectoryError();
  }

  openExisting(flags, thread) {
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }

  openExecutable() {
    throw new AccessError();
  }

  readlink() {
    throw new InvalidError();
  }
}

const search = async (mount, id, component) => {
  const {id: childId, fmt: childFmt} = await mount.fs.search(id, component);
  return makeFileLocationFollowMounts(mount, childId, childFmt);
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

  unlink(...args) {
    return this.mount.unlink(this.id, ...args);
  }

  rmdir(...args) {
    return this.mount.rmdir(this.id, ...args);
  }

  async openExisting(flags, ...args) {
    if (flags & O.WRITE) throw new IsADirectoryError();
    const newFile = await this.mount.fs.openExistingDirectory(this.id, flags, ...args);
    newFile.fileLoc = this.incRefCount();
    return newFile;
  }

  async openCreate(...args) {
    const {fileDesc, childId} = await this.mount.fs.openCreate(this.id, ...args);
    fileDesc.fileLoc = new RegularFileLocation(this.mount, childId);
    return fileDesc;
  }
}

class RegularFileLocation extends FileLocation {
  constructor(...args) {
    super(...args);
    this.fileType = FMT.REGULAR;
  }

  async openExisting(flags, ...args) {
    const newFile = await this.mount.fs.openExistingRegular(this.id, flags, ...args);
    newFile.fileLoc = this.incRefCount();
    if (flags & O.TRUNC && flags & O.WRITE) newFile.truncate();
    return newFile;
  }

  openExecutable(...args) {
    return this.mount.fs.openExecutable(this.id, ...args);
  }
}

class SymlinkLocation extends FileLocation {
  constructor(...args) {
    super(...args);
    this.fileType = FMT.SYMLINK;
  }

  readlink(...args) {
    return this.mount.fs.readlink(this.id, ...args);
  }
}

class DeviceLocation extends FileLocation {
  constructor(...args) {
    super(...args);
    this.fileType = FMT.DEVICE;
  }

  async openExisting(...args) {
    const newFile = await this.mount.fs.openExistingDevice(this.id, ...args);
    newFile.fileLoc = this.incRefCount();
    return newFile;
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

const makeFileLocationFollowMounts = (mount, id, fmt) => {
  let childMount = mount.children.get(id);
  while (childMount) {
    mount = childMount;
    id = childMount.bindRoot;
    childMount = mount.children.get(id);
  }
  return makeFileLocation(mount, id, fmt);
};

export {
  DirectoryLocation,
  RegularFileLocation,
  SymlinkLocation,
  DeviceLocation,
  FIFOLocation,
  SocketLocation,
  makeFileLocation,
  makeFileLocationFollowMounts,
  equalFileLocations,
};
