import {FileSystem} from './fs.js';
import {componentToBinaryString} from './Path.js';
import {FMT} from '../constants/fs.js';
import {NoEntryError, ExistsError} from './errors.js';
import {InvalidError} from '../syscall/linux/InvalidError.js';
import {openDeviceFile} from '../devices/open.js';

// TODO: check permissions

class RegularFile {
  constructor() {
    this.dataBuf = new Uint8Array(64);
    this.length = 0;
    this.nlink = 0;
  }
}

class Directory {
  constructor(parentId) {
    this.parentId = parentId;
    // map from componentToBinaryString(component) to {id, fmt} entries.
    this.children = new Map();
    this.nlink = 2;
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

class DeviceFile {
  constructor(rdev) {
    this.rdev = rdev;
  }
}

class RamFS extends FileSystem {
  constructor() {
    super();
    this.files = new Map();
    this.idCounter = 1n;
    this.rootId = this.idCounter++;
    const rootDirectory = new Directory(this.rootId);
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
    const newDirectory = new Directory(parent);
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
    const newDevFile = new DeviceFile(rdev);
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

  stat(id, syncFlag) {
    // TODO
    debugger;
    thread.requestUserDebugger();
    throw new InvalidError();
  }

  openExistingDevice(id, ...args) {
    const devFile = this.files.get(id);
    return openDeviceFile(devFile.rdev, ...args);
  }
}

void RegularFile;
export {RamFS};
