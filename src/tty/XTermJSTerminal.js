import {Terminal as KTerminal} from './Terminal.js';
import {Lock} from '../util/Lock.js';

/*const writevToString = (data) => {
  const decoder = new TextDecoder();
  const strings = [];
  for (const arr of data) strings.push(decoder.decode(new Uint8Array(arr), {stream: true}));
  return strings.join('');
};*/

const CHUNK_LENGTH = 200000; // bytes in one of two chunks
const EMPTY_BYTE_ARRAY = new Uint8Array();

class XTermJSTerminal extends KTerminal {
  constructor(div) {
    super();
    this.div = div;
    this.term  = new Terminal();
    this.term.open(this.div);
    this.term.onBinary(() => { debugger; });
    this.term.onData((data) => this.getUSVStringInput(data));
    this.watermark = 0;
    this.secondChunkReady = Promise.resolve();
    this.writeLock = new Lock();
  }

  get rows() { return this.term.rows; }
  get cols() { return this.term.cols; }

  // data should be an array of non-shared Uint8Arrays
  writeBytesBlocking(data) {
    return this.writeDataBlocking(data, Uint8Array.prototype.subarray);
  }

  // data should be an array of USVString
  writeStringsBlocking(data) {
    this.writeDataBlocking(data, String.prototype.substring);
  }

  // data should be an array of objects that have .length and
  // which subarray acts on.
  // Blocks until all bytes have been transferred to the terminal,
  // not until the terminal has processed those bytes.
  // Blocks due to flow control.
  writeDataBlocking(data, subarray) {
    // Holding our write lock makes writes atomic
    return this.writeLock.withLockAsync(async () => {
      for (let arr of data) {
        while (arr.length > 0) {
          const start = this.bytesWrittenInChunk;
          const end = start + arr.length;
          if (end < CHUNK_LENGTH) {
            this.bytesWrittenInChunk = end;
            this.term.write(arr);
            arr = subarray.call(arr, arr.length);
          } else {
            const split = CHUNK_LENGTH - start;
            this.term.write(subarray.call(arr, 0, split));
            arr = subarray.call(arr, split);
            await this.secondChunkReady;
            this.bytesWrittenInChunk = 0;
            this.secondChunkReady = new Promise((resolve) => {
              this.term.write(EMPTY_BYTE_ARRAY, resolve);
            });
          }
        }
      }
    });
  }
}

export {XTermJSTerminal};
