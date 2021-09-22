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
}

class DirectoryLocation extends FileLocation {
  search(component) {
    return this.mount.search(this.id, component);
  }

  parentDirectory() {
    return this.mount.parentDirectory(this.id);
  }
}

export {
  FileLocation,
  DirectoryLocation,
};
