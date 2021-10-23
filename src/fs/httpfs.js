import {FileSystem} from './fs.js';
import {componentToUTF8String} from './Path.js';
import {FMT, fmtToMode, ACCESS, O} from '../constants/fs.js';
import {NoEntryError, ReadOnlyFilesystemError} from './errors.js';
import {LRUCache} from '../util/LRUCache.js';
import {OpenRegularFileDescription, OpenDirectoryDescription} from '../OpenFileDescription.js';
import {executableFromBlob} from '../util/executableFromBlob.js';

const ROOT_ID = 1n;

const CONTENT_JSON = 'application/json';
const CONTENT_BYTES = 'application/octet-stream';

const loadDirectory = (dirData) => {
  for (const pair of dirData.children) pair[1].id = BigInt(pair[1].id);
  dirData.children = new Map(dirData.children);
  dirData.parent = BigInt(dirData.parent);
  return dirData;
};

class HttpOpenRegularFileDescription extends OpenRegularFileDescription {
  constructor(contentsPromise, flags) {
    super(flags);
    this.contentsPromise = contentsPromise;
  }

  async readv(data) {
    const contents = await this.contentsPromise;
    let bytesRead = 0;
    for (const arr of data) {
      if (this.offset + arr.length <= contents.length) {
        arr.set(contents.subarray(this.offset, arr.length));
        this.offset += arr.length;
        bytesRead += arr.length;
      } else {
        arr.set(contents.subarray(this.offset));
        const lastChunk = contents.length - this.offset;
        this.offset += lastChunk;
        bytesRead += lastChunk;
        break;
      }
    }
    return bytesRead;
  }

  writev() {
    throw new Error("writev should never be called on a read only filesystem");
  }
}

class HttpOpenDirectoryDescription extends OpenDirectoryDescription {
  constructor(listingPromise, flags) {
    super(flags);
    this.listingPromise = listingPromise;
  }
}

// TODO: permissions checks
// This needs the various methods to be passed some context, particularly
// the user and group ids, possibly along with a superuser override.
// May be easiest to pass the thread, or maybe the process, if that has all
// relevant data.

class ReadOnlyHttpFS extends FileSystem {
  constructor(url) {
    super();
    this.url = url;
    this.metaCache = new LRUCache(1000); // caches file metadata
    this.dataCache = new LRUCache(1000); // caches directories and symlinks
  }

  async loadMetadata(id) {
    let meta = this.metaCache.get(id);
    if (meta) return meta;
    const url = `${this.url}/meta/${id}`;
    const response = await fetch(url, {headers: {Accept: CONTENT_JSON}});
    meta = await response.json();
    meta.size = BigInt(meta.size);
    meta.timestamp = BigInt(meta.timestamp);
    this.metaCache.set(id, meta);
    return meta;
  }

  async loadDataJson(id, func = (x) => x) {
    let data = this.dataCache.get(id);
    if (data) return data;
    const url = `${this.url}/data/${id}`;
    const response = await fetch(url, {headers: {Accept: CONTENT_JSON}});
    data = func(await response.json());
    this.dataCache.set(id, data);
    return data;
  }

  loadDataResponse(id) {
    const url = `${this.url}/data/${id}`;
    return fetch(url, {headers: {Accept: CONTENT_BYTES}});
  }

  async loadDataBlob(id) {
    const response = await this.loadDataResponse(id);
    return response.blob();
  }

  async loadDataContents(id) {
    const blob = await this.loadDataBlob(id);
    const arrayBuffer = await blob.arrayBuffer();
    const contents = new Uint8Array(arrayBuffer);
    return contents;
  }

  async search(id, component) {
    // TODO: permissions checks
    const metadata = await this.loadMetadata(id);
    if (metadata.fmt !== FMT.DIRECTORY) throw new Error("Not a directory");
    const data = await this.loadDataJson(id, loadDirectory);
    const name = componentToUTF8String(component);
    if (name === null) throw new NoEntryError();
    const childEntry = data.children.get(name);
    if (!childEntry) throw new NoEntryError();
    return childEntry;
  }

  async parentDirectory(id) {
    // TODO: permissions checks
    const metadata = await this.loadMetadata(id);
    if (metadata.fmt !== FMT.DIRECTORY) throw new Error("Not a directory");
    const data = await this.loadDataJson(id, loadDirectory);
    return data.parent;
  }

  async stat(id) {
    const metadata = await this.loadMetadata(id);
    const timestamp = {sec: metadata.timestamp, nsec: 0};
    return {
      blksize: 1024,
      nlink: metadata.nlinks,
      uid: metadata.uid,
      gid: metadata.gid,
      mode: metadata.mode | fmtToMode(metadata.fmt),
      size: metadata.size,
      blocks: ((metadata.size - 1n) >> 9n) + 1n,
      atime: timestamp,
      ctime: timestamp,
      mtime: timestamp,
    };
  }

  async access(id, mode, useEffectiveIds, thread) {
    if (mode & ACCESS.W) throw new ReadOnlyFilesystemError();
    const metadata = await this.loadMetadata(id);
    // TODO: permissions checks
    void metadata;
    void useEffectiveIds;
    void thread;
  }

  openExistingRegular(id, flags) {
    // We know this is a regular file
    if (flags & O.WRITE) throw new ReadOnlyFilesystemError();
    return new HttpOpenRegularFileDescription(this.loadDataContents(id), flags);
  }

  async openExecutable(id, thread) {
    // TODO: permissions checks
    void thread;
    const blob = await this.loadDataBlob(id);
    return executableFromBlob(blob);
  }

  openExistingDirectory(id, flags) {
    return new HttpOpenDirectoryDescription(this.loadDataJson(id, loadDirectory), flags);
  }
}

export {ReadOnlyHttpFS, ROOT_ID};
