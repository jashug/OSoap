import {FMT} from '../constants/fs.js';

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

  stat(syncFlag, mask) {
    return this.mount.fs.stat(this.id, syncFlag, mask);
  }

  access(mode) {
    return this.mount.fs.access(this.id, mode);
  }

  openExisting(flags) {
    return this.mount.fs.openExisting(this.id, flags);
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
  search(component) {
    return search(this.mount, this.id, component);
  }

  parentDirectory() {
    return parentDirectory(this.mount, this.id);
  }
}

class RegularFileLocation extends FileLocation {
  constructor(...args) {
    super(...args);
    this.fileType = FMT.REGULAR;
  }
}

class SymlinkLocation extends FileLocation {
  constructor(...args) {
    super(...args);
    this.fileType = FMT.SYMLINK;
  }
}

const FileLocationTypes = new Map([
  [FMT.REGULAR, RegularFileLocation],
  [FMT.DIRECTORY, DirectoryLocation],
  [FMT.SYMLINK, SymlinkLocation],
]);

const makeFileLocation = (mount, id, fmt) => {
  const FileLocationFmt = FileLocationTypes.get(fmt);
  return new FileLocationFmt(mount, id);
};

export {
  DirectoryLocation,
  RegularFileLocation,
  SymlinkLocation,
  makeFileLocation,
};
