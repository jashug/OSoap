import {MultiSet} from '../util/MultiSet.js';
/* Paths could be parsed into
 * { absolute: bool, components: Array<?>, trailingSlash: bool }
 * I'm not sure what type a component should be, a DOMString, a Uint8Buffer?
 */

class FileSystem {
  constructor() {
    this.virtualLinksIn = new MultiSet(); // rmdir on these create orphan directories (unlinked but open)
    this.virtualLinksOut = new MultiSet(); // These return EBUSY on rmdir
  }
}

class Mount {
  constructor(fs, bindRoot, parent, mountPoint) {
    this.parent = parent; // another Mount
    this.children = new Map(); // map from mount point to child mount
    this.mountPoint = mountPoint; // an id in parent
    this.fs = fs;
    this.bindRoot = bindRoot; // an id in fs
    this.mountType = null;
    // the file type of mountPoint and bindRoot should
    // both be the same as this.mountType (this ensures that the
    // cached file type in direntries remains accurate).
    this.parent.addChildMount(this);
    this.fs.virtualLinksIn.inc(this.bindRoot); // Take a regular reference
  }

  addChildMount(childMount) {
    const mountPoint = childMount.mountPoint;
    this.fs.virtualLinksOut.inc(mountPoint);
    // The above prevents this directory from being unlinked,
    // even if it looks empty in this mount.
    // That is, if we have two mounts of the same filesystem, which contains an
    // empty directory, and in one of those mounts there is another filesystem
    // mounted on the empty directory (but not in the other mount), we should
    // prevent rmdir even on the mount where the directory looks empty.
    if (this.children.has(mountPoint)) {
      throw new Error("Add child mount on existing mount point");
      // Instead follow the mount to the child and add the mount there.
    }
    this.children.set(mountPoint, childMount);
  }

  removeChildMount(childMount) {
    const mountPoint = childMount.mountPoint;
    const existed = this.children.delete(mountPoint);
    if (!existed) throw new Error("Remove non-existent cihld mount");
    this.fs.virtualLinksOut.dec(mountPoint);
  }

  unmount() {
    if (this.children.size() > 0) {
      // TODO: error EBUSY, should unmount children first
      throw new Error("TODO");
    }
    this.fs.virtualLinksIn.dec(this.bindRoot);
    this.parent.removeChildMount(this);
  }
}

export {FileSystem, Mount};
