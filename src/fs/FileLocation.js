// Can be moved around; not an immutable type.
// Holds a virtual link in to the file.
// File type {regular, directory, symlink, ...} should be known
// but is not tracked here.
class FileLocation {
  constructor(mount, id) {
    this.mount = mount;
    this.id = id;
    this.mount.incRef(this.id);
  }

  copy() {
    return new FileLocation(this.mount, this.id);
  }

  // Always call dispose exactly once
  dispose() {
    this.mount.decRef(this.id);
    this.mount = null;
  }

  // Requires that this file is a directory
  search(component) {
    return this.mount.search(this.id, component);
  }
}

export {FileLocation};
