import {FileSystem} from './fs.js';
import {componentToBinaryString, binaryStringToComponent} from './Path.js';
import {FMT, fmtToMode} from '../constants/fs.js';
import {NoEntryError, ExistsError} from './errors.js';
import {openDeviceFile} from '../devices/open.js';
import {currentTimespec} from '../util/currentTime.js';
import {OpenDirectoryDescription} from '../OpenFileDescription.js';

// TODO: check permissions
// TODO: set mode correctly

class RAMFile {
  constructor(fmt, mode) {
    this.fmt = fmt;
    this.nlink = 1;
    // TODO: support setting uid/gid
    this.uid = 0;
    this.gid = 0;
    this.mode = mode;
    this.btime = currentTimespec();
    this.atime = this.btime;
    this.ctime = this.btime;
    this.mtime = this.btime;
  }
}

class RegularFile extends RAMFile {
  constructor(...args) {
    super(FMT.REGULAR, ...args);
    this.dataBuf = new Uint8Array(64);
    this.length = 0;
  }

  get size() { return BigInt(this.length); }
}

class Directory extends RAMFile {
  constructor(parentId, ...args) {
    super(FMT.DIRECTORY, ...args);
    this.parentId = parentId;
    // map from componentToBinaryString(component) to {id, fmt} entries.
    this.children = new Map();
    this.nlink += 1;
    this.size = 0n;
  }

  addLink(name, entry) {
    if (name === '.' || name === '..') {
      throw new Error(`add link with name ${name}`);
    }
    if (this.children.has(name)) {
      throw new ExistsError();
    }
    this.children.set(name, entry);
  }
}

class RamOpenDirectoryDescription extends OpenDirectoryDescription {
  constructor(dir, flags) {
    super(flags);
    this.dir = dir;
    this.listing = Array.from(this.dir.children);
    this.offset = 0;
  }

  readDirEntry() {
    if (this.offset >= this.listing.length) return null;
    const [name, {id, fmt}] = this.listing[this.offset];
    const nameBuf = binaryStringToComponent(name);
    const tellPos = BigInt(this.offset);
    this.offset++;
    return {id, fmt, tellPos, nameBuf};
  }
}

class DeviceFile extends RAMFile {
  constructor(rdev, ...args) {
    super(FMT.DEVICE, ...args);
    this.rdev = rdev;
    this.size = 0n;
  }
}

class RamFS extends FileSystem {
  constructor() {
    super();
    this.files = new Map();
    this.idCounter = 1n;
    this.rootId = this.idCounter++;
    const rootDirectory = new Directory(this.rootId, 0o777);
    this.files.set(this.rootId, rootDirectory);
  }

  mkdir(parent, component, ...args) {
    return this.mkdirString(parent, componentToBinaryString(component), ...args);
  }

  mkdirString(parent, name) {
    const id = this.idCounter++;
    const parentDirectory = this.files.get(parent);
    parentDirectory.addLink(name, {id, fmt: FMT.DIRECTORY});
    parentDirectory.nlink++;
    const newDirectory = new Directory(parent, 0o777);
    this.files.set(id, newDirectory);
    return id;
  }

  makeDevFile(parent, component, ...args) {
    return this.makeDevFileString(parent, componentToBinaryString(component), ...args);
  }

  makeDevFileString(parent, name, rdev) {
    const id = this.idCounter++;
    const parentDirectory = this.files.get(parent);
    parentDirectory.addLink(name, {id, fmt: FMT.DEVICE});
    const newDevFile = new DeviceFile(rdev, 0o777);
    this.files.set(id, newDevFile);
    return id;
  }

  parentDirectory(id) {
    return this.files.get(id).parentId;
  }

  search(id, component) {
    const entry =
      this.files.get(id).children.get(componentToBinaryString(component));
    if (!entry) throw new NoEntryError();
    return entry;
  }

  stat(id) {
    const file = this.files.get(id);
    return {
      blksize: 1024,
      nlink: file.nlink,
      uid: file.uid,
      gid: file.gid,
      mode: file.mode | fmtToMode(file.fmt),
      size: file.size,
      blocks: ((file.size - 1n) >> 9n) + 1n,
      atime: file.atime,
      ctime: file.ctime,
      mtime: file.mtime,
    };
  }

  access(id, mode, useEffectiveIds, thread) {
    void id, mode, useEffectiveIds, thread;
    debugger;
  }

  openExistingRegular(id, flags) {
    void id, flags;
    debugger;
  }

  openExecutable(id, thread) {
    void id, thread;
    debugger;
  }

  openExistingDevice(id, ...args) {
    const devFile = this.files.get(id);
    return openDeviceFile(devFile.rdev, ...args);
  }

  openExistingDirectory(id, flags) {
    return new RamOpenDirectoryDescription(this.files.get(id), flags);
  }

  readlink(id) {
    void id;
    debugger;
  }
}

void RegularFile;
export {RamFS};
