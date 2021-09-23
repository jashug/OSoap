import {FileSystem} from './fs.js';
import {componentToUTF8String} from './Path.js';
import {FMT} from '../constants/fs.js';
import {NoEntryError} from './errors.js';
import {LRUCache} from '../util/LRUCache.js';

const ROOT_ID = 1;

const CONTENT_JSON = 'application/json';
const CONTENT_BYTES = 'application/octet-stream';

const loadDirectory = (dirData) => {
  dirData.children = new Map(dirData.children);
  return dirData;
}

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

  async loadDataBlob(id) {
    const url = `${this.url}/data/${id}`;
    const response = await fetch(url, {headers: {Accept: CONTENT_BYTES}});
    return response.blob();
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
}

export {ReadOnlyHttpFS, ROOT_ID};
