import {MultiSet} from '../util/MultiSet.js';
import {BusyError} from './errors.js';

let nonDeviceMountsCounter = 1;

class FileSystem {
  constructor(dev = {major: 0, minor: nonDeviceMountsCounter++}) {
    this.virtualLinksIn = new MultiSet(); // rmdir on these create orphan directories (unlinked but open)
    this.virtualLinksOut = new MultiSet(); // These return EBUSY on rmdir
    this.orphans = new Set();
    this.dev = dev;
  }

  incLinkIn(id) {
    this.virtualLinksIn.inc(id);
  }

  decLinkIn(id) {
    if (this.virtualLinksIn.dec(id) === 0 && this.orphans.has(id)) this.freeFileId(id);
  }

  markOrphanedFileId(id) {
    if (this.virtualLinksOut.has(id)) throw new BusyError();
    if (!this.virtualLinksIn.has(id)) this.freeFileId(id);
    else this.orphans.add(id); // TODO add extension for persistent orphan lists
  }

  freeFileId(id) {
    void id;
    debugger;
    throw new Error("Unimplemented free file id filesystem method");
  }
}

class Mount {
  constructor(fs, bindRoot, parent, mountPoint) {
    this.parent = parent; // another Mount
    this.children = new Map(); // map from mount point to child mount
    this.mountPoint = mountPoint; // an id in parent
    this.fs = fs;
    this.bindRoot = bindRoot; // an id in fs
    // TODO: check and set mountType
    this.mountType = null;
    // the file type of mountPoint and bindRoot should
    // both be the same as this.mountType (this ensures that the
    // cached file type in direntries remains accurate).
    this.refCount = 0;
    this.parent?.addChildMount(this);
    this.fs.virtualLinksIn.inc(this.bindRoot); // Take a regular reference
  }

  addChildMount(childMount) {
    const mountPoint = childMount.mountPoint;
    if (this.parent === null && this.bindRoot === mountPoint) {
      throw new Error("Attempted to mount on absolute root");
      // TODO: give a gentler error rather than crashing the kernel
    }
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
    if (!existed) throw new Error("Remove non-existent child mount");
    this.fs.virtualLinksOut.dec(mountPoint);
  }

  unmount() {
    if (this.children.size() > 0 || this.refCount > 0) {
      // TODO: error EBUSY, should unmount children first
      throw new Error("TODO");
    }
    this.fs.virtualLinksIn.dec(this.bindRoot);
    this.parent.removeChildMount(this);
  }

  incRef(id) {
    this.fs.incLinkIn(id);
    this.refCount += 1;
  }

  decRef(id) {
    this.fs.decLinkIn(id);
    this.refCount -= 1;
  }
}

const makeRootMount = (fs, rootId) => {
  return new Mount(fs, rootId, null, 0n);
};

export {FileSystem, Mount, makeRootMount};
