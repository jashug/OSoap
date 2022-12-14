import {FileSystem} from './fs.js';
import {componentToBinaryString, binaryStringToComponent} from './Path.js';
import {FMT, fmtToMode, O, SEEK} from '../constants/fs.js';
import {NoEntryError, ExistsError, FileTooBigError, IsADirectoryError, NotADirectoryError} from './errors.js';
import {openDeviceFile} from '../devices/open.js';
import {currentTimespec} from '../util/currentTime.js';
import {OpenRegularFileDescription, OpenDirectoryDescription} from '../OpenFileDescription.js';
import {executableFromUint8Array} from '../util/executableFromBlob.js';

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
    this.truncate();
  }

  get size() { return BigInt(this.length); }

  truncate() {
    this.dataBuf = new Uint8Array(64);
    this.length = 0;
  }
}

class RamOpenRegularFileDescription extends OpenRegularFileDescription {
  constructor(file, flags) {
    super(flags);
    this.file = file;
  }

  truncate(...args) {
    this.offset = 0;
    return this.file.truncate(...args);
  }

  readv(data, thread, totalLen) {
    void thread, totalLen;
    let bytesRead = 0;
    for (const arr of data) {
      if (this.offset + arr.length <= this.file.length) {
        arr.set(this.file.dataBuf.subarray(this.offset, this.offset + arr.length));
        this.offset += arr.length;
        bytesRead += arr.length;
      } else {
        const lastChunk = Math.max(this.file.length - this.offset, 0);
        arr.set(this.file.dataBuf.subarray(this.offset, this.file.length));
        this.offset += lastChunk;
        bytesRead += lastChunk;
        break;
      }
    }
    return bytesRead;
  }

  writev(data, thread, totalLen) {
    if (this.flagAppend) this.offset = this.file.length;
    const newOffset = this.offset + totalLen;
    if (newOffset > this.file.dataBuf.length) {
      if (newOffset > Number.MAX_SAFE_INTEGER) throw new FileTooBigError();
      const newDataBuf = new Uint8Array(Math.min(newOffset * 2, Number.MAX_SAFE_INTEGER));
      newDataBuf.set(this.file.dataBuf);
      this.file.dataBuf = newDataBuf;
    }
    for (const arr of data) {
      this.file.dataBuf.set(arr, this.offset);
      this.offset += arr.length;
    }
    if (this.offset !== newOffset) throw new Error("bad totalLen");
    this.file.length = Math.max(this.offset, this.file.length);
    return totalLen;
  }

  // This may be able to be pulled into OpenRegularFileDescription
  lseek(offset, whence) {
    if (whence === SEEK.SET) {
      return this.setOffsetChecked_(offset);
    } else if (whence === SEEK.CUR) {
      return this.setOffsetChecked_(offset + this.offset);
    } else if (whence === SEEK.END) {
      return this.setOffsetChecked_(offset + this.file.length);
    }
  }
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
  }

  readDirEntry() {
    if (this.offset >= this.listing.length) return null;
    const [name, {id, fmt}] = this.listing[this.offset];
    const nameBuf = binaryStringToComponent(name);
    const tellPos = BigInt(this.offset);
    this.offset++;
    return {id, fmt, tellPos, nameBuf};
  }

  lseek(offset, whence) {
    if (whence === SEEK.SET) {
      return this.setOffset_(offset);
    } else if (whence === SEEK.CUR) {
      return this.setOffset_(offset + this.offset);
    } else if (whence === SEEK.END) {
      return this.setOffset_(offset + this.listing.length);
    }
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

  freeFileId(id) {
    this.files.delete(id);
  }

  makeFileInternal(parentDirectory, name, mode) {
    const id = this.idCounter++;
    parentDirectory.addLink(name, {id, fmt: FMT.REGULAR});
    const newFile = new RegularFile(mode);
    this.files.set(id, newFile);
    return {id, file: newFile};
  }

  mkdir(parent, component, ...args) {
    return this.mkdirString(parent, componentToBinaryString(component), ...args);
  }

  mkdirString(parent, name, mode, thread) {
    void mode, thread;
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

  incNLink(id, file) {
    if (file.nlink === 0) {
      debugger;
      // TODO: un-orphaning files
    }
    file.nlink += 1;
  }

  decNLink(id, file) {
    if (file.nlink <= 0) throw new Error("file nlink inconsistency");
    if (file.nlink === 1) this.markOrphanedFileId(id);
    file.nlink -= 1;
  }

  unlink(id, component, trailingSlash, thread) {
    void thread;
    const directory = this.files.get(id);
    const name = componentToBinaryString(component);
    const entry = directory.children.get(name);
    if (!entry) throw new NoEntryError();
    const {id: childId, fmt} = entry;
    if (fmt === FMT.DIRECTORY) throw new IsADirectoryError();
    if (trailingSlash) throw new NotADirectoryError();
    const file = this.files.get(childId);
    this.decNLink(childId, file);
    directory.children.delete(name);
    return 0;
  }

  rmdir(id, component, thread) {
    void thread;
    const directory = this.files.get(id);
    const name = componentToBinaryString(component);
    const entry = directory.children.get(name);
    if (!entry) throw new NoEntryError();
    const {id: childId, fmt} = entry;
    if (fmt !== FMT.DIRECTORY) throw new NotADirectoryError();
    const file = this.files.get(childId);
    this.decNLink(childId, file);
    this.decNLink(id, directory);
    directory.children.delete(name);
    return 0;
  }

  rename(oldid, oldcomponent, newid, newcomponent, flags, thread) {
    void thread;
    const olddirectory = this.files.get(oldid);
    const newdirectory = this.files.get(newid);
    const oldname = componentToBinaryString(oldcomponent);
    const newname = componentToBinaryString(newcomponent);
    const oldentry = olddirectory.children.get(oldname);
    if (!oldentry) throw new NoEntryError();
    const {id: oldId, fmt: oldFmt} = oldentry;
    const fileToLink = this.files.get(oldId);
    const newentry = newdirectory.children.get(newname);
    if (newentry) {
      const {id: newId, fmt: newFmt} = newentry;
      if (oldId === newId) return 0;
      if (oldFmt === FMT.DIRECTORY) {
        if (newFmt !== FMT.DIRECTORY) throw new NotADirectoryError();
        const fileToRemove = this.files.get(newId);
        void fileToRemove;
        debugger;
        throw new Error("TODO: Unimplemented rename onto directory");
      } else {
        if (newFmt === FMT.DIRECTORY) throw new IsADirectoryError();
        const fileToRemove = this.files.get(newId);
        this.decNLink(newId, fileToRemove);
        this.incNLink(oldId, fileToLink);
        newdirectory.children.set(newname, oldentry);
      }
    } else {
      this.incNLink(oldId, fileToLink);
      newdirectory.children.set(newname, oldentry);
    }
    return 0;
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
      rdev: file.rdev ?? {major: 0, minor: 0},
    };
  }

  access(id, mode, useEffectiveIds, thread) {
    void id, mode, useEffectiveIds, thread;
    debugger;
  }

  openCreate(id, flags, mode, component, thread) {
    void thread;
    const name = componentToBinaryString(component);
    const parentDirectory = this.files.get(id);
    const entry = parentDirectory.children.get(name);
    if (entry) {
      if (flags & O.EXCL) throw new ExistsError();
      return entry;
    } else {
      const {id: childId, file} = this.makeFileInternal(parentDirectory, name, mode);
      const fileDesc = new RamOpenRegularFileDescription(file, flags);
      return {fileDesc, childId};
    }
  }

  openExistingRegular(id, flags) {
    const file = this.files.get(id);
    return new RamOpenRegularFileDescription(file, flags);
  }

  openExecutable(id, thread) {
    void thread;
    const file = this.files.get(id);
    return executableFromUint8Array(file.dataBuf.subarray(0, file.length));
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
