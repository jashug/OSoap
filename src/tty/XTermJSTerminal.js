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

  drain() {
    return new Promise((resolve) => this.term.write("", resolve));
  }

  flush() {
    debugger;
  }

  get rows() { return this.term.rows; }
  get cols() { return this.term.cols; }

  // data should be an array of non-shared Uint8Arrays
  // Blocks until all bytes have been transferred to the terminal,
  // not until the terminal has processed those bytes.
  // Blocks due to flow control.
  writeBytesBlocking(data) {
    // Holding our write lock makes writes atomic
    return this.writeLock.withLock(async () => {
      for (let arr of data) {
        while (arr.length > 0) {
          const start = this.bytesWrittenInChunk;
          const end = start + arr.length;
          if (end < CHUNK_LENGTH) {
            this.bytesWrittenInChunk = end;
            this.term.write(arr);
            arr = arr.subarray(arr.length);
          } else {
            const split = CHUNK_LENGTH - start;
            this.term.write(arr.subarray(0, split));
            arr = arr.subarray(split);
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
