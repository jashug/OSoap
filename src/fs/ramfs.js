import {FileSystem} from './fs.js';

class RegularFile {
  constructor() {
    this.dataBuf = new Uint8Array(64);
    this.length = 0;
  }
}

class RamFS extends FileSystem {
  constructor() {
    super();
    this.files = new Map();
    this.idCounter = 1;
  }
}

export {RamFS};
