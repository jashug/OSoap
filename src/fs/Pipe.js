import {OpenFileDescription} from '../OpenFileDescription.js';
import {O} from '../constants/fs.js';
import {Queue, ScatteredByteQueue} from '../util/Queue.js';
import {FileSystem, makeRootMount} from './fs.js';
import {FIFOLocation} from './FileLocation.js';
import {InvalidError} from '../syscall/linux/Invaliderror.js';
import {PipeError} from './errors.js';

// From sysroot/include/limits.h
const PIPE_BUF = 4096;
const CAPACITY = PIPE_BUF * 2;

// Requires totalLen(target) >= totalLen(source)
const writeScatteredBuffers = (target, source) => {
  const targetQueue = new Queue(target);
  const sourceQueue = new Queue(source);
  while (targetQueue.size && sourceQueue.size) {
    const targetArr = targetQueue.dequeue();
    const sourceArr = sourceQueue.dequeue();
    if (targetArr.length < sourceArr.length) {
      targetArr.set(sourceArr.subarray(0, targetArr.length));
      sourceQueue.pushFront(sourceArr.subarray(targetArr.length));
    } else if (targetArr.length > sourceArr.length) {
      targetArr.set(sourceArr);
      targetQueue.pushFront(targetArr.subarray(sourceArr.length));
    } else {
      // targetArr.length === sourceArr.length
      targetArr.set(sourceArr);
    }
  }
};

class Pipe {
  constructor(uid, gid) {
    this.buffer = new ScatteredByteQueue();
    this.writeQueue = new Queue();
    this.bytesInWriteQueue = 0;
    this.readQueue = new Queue();
    this.bytesInReadQueue = 0;
    this.uid = uid;
    this.gid = gid;
    this.numOpenReaders = 0;
    this.numOpenWriters = 0;
  }

  get remainingCapacity() {
    return CAPACITY - this.buffer.size;
  }

  get readableBytes() {
    return this.buffer.size + this.bytesInWriteQueue;
  }

  process_() {
    if (Boolean(this.bytesInWriteQueue) !== Boolean(this.writeQueue.size)) {
      throw new Error("broken invariant");
    }
    // Process read requests
    while (this.readQueue.size) {
      if (this.readableBytes) {
        const readRequest = this.readQueue.dequeue();
        this.bytesInReadQueue -= readRequest.totalLen;
        const bytesToRead = Math.min(this.readableBytes, readRequest.totalLen);
        writeScatteredBuffers(readRequest.data, this.consumeBytesForRead(bytesToRead));
        readRequest.resolve(bytesToRead);
      } else {
        if (!this.numOpenWriters) {
          const readRequest = this.readQueue.dequeue();
          readRequest.resolve(0);
        } else {
          break;
        }
      }
    }
    // Fill up the buffer
    while (this.writeQueue.size) {
      const writeRequest = this.writeQueue.dequeue();
      this.bytesInWriteQueue -= writeRequest.dataQueue.size;
      if (!this.numOpenReaders) {
        // TODO: also send signal SIGPIPE
        writeRequest.reject(new PipeError());
        continue;
      }
      if (writeRequest.dataQueue.size > this.remainingCapacity && writeRequest.totalLen <= PIPE_BUF) {
        // Write should be atomic, but we don't have room to satisfy it yet
        this.bytesInWriteQueue += writeRequest.dataQueue.size;
        this.writeQueue.pushFront(writeRequest);
        break;
      }

      const bytesToBuffer = Math.min(this.remainingCapacity, writeRequest.dataQueue.size);
      const toWriteToBuffer = writeRequest.dataQueue.consume(bytesToBuffer);
      for (const arr of toWriteToBuffer) {
        this.buffer.push(new Uint8Array(arr)); // Perform a copy to take ownership of the memory
      }
      // Put remainder back
      if (writeRequest.dataQueue.size) {
        this.writeQueue.pushFront(writeRequest);
        this.bytesInWriteQueue += writeRequest.dataQueue.size;
        break;
      } else {
        writeRequest.resolve(writeRequest.totalLen);
      }
    }
  }

  // Precondition: len should be at most this.readableBytes
  consumeBytesForRead(len) {
    const out = [];
    const satisfiableFromBuffer = Math.min(len, this.buffer.size);
    this.buffer.consume(satisfiableFromBuffer, out);
    len -= satisfiableFromBuffer;
    while (this.bytesInWriteQueue && len) {
      const writeRequest = this.writeQueue.dequeue();
      this.bytesInWriteQueue -= writeRequest.dataQueue.size;
      // Here the buffer is empty, so we can get started on any sized write request
      const satisfiableFromWriteRequest = Math.min(len, writeRequest.dataQueue.size);
      writeRequest.dataQueue.consume(satisfiableFromWriteRequest, out);
      len -= satisfiableFromWriteRequest;
      // Put remainder back
      if (writeRequest.dataQueue.size) {
        this.writeQueue.pushFront(writeRequest);
        this.bytesInWriteQueue += writeRequest.dataQueue.size;
      } else {
        writeRequest.resolve(writeRequest.totalLen);
      }
    }
    return out;
  }

  queueWrite({data, totalLen}) {
    const ret = new Promise((resolve, reject) => {
      const dataQueue = new ScatteredByteQueue();
      dataQueue.pushMulti(data);
      this.writeQueue.enqueue({
        dataQueue,
        totalLen,
        resolve,
        reject,
      });
      if (dataQueue.size !== totalLen) throw new Error("inconsistent sizes");
      this.bytesInWriteQueue += totalLen;
    });
    this.process_();
    return ret;
  }

  queueRead({data, totalLen}) {
    const ret = new Promise((resolve, reject) => {
      this.readQueue.enqueue({
        data,
        totalLen,
        resolve,
        reject,
      });
      this.bytesInReadQueue += totalLen;
    });
    this.process_();
    return ret;
  }

  openNewReadEnd(statusFlags) {
    this.numOpenReaders++;
    const readEnd = new PipeReadEnd(this, statusFlags);
    readEnd.fileLoc = this.fileLoc.incRefCount();
    return readEnd;
  }

  openNewWriteEnd(statusFlags) {
    this.numOpenWriters++;
    const writeEnd = new PipeWriteEnd(this, statusFlags);
    writeEnd.fileLoc = this.fileLoc.incRefCount();
    return writeEnd;
  }

  decNumOpenReaders() {
    this.numOpenReaders--;
    this.process_();
  }

  decNumOpenWriters() {
    this.numOpenWriters--;
    this.process_();
  }
}

class PipeReadEnd extends OpenFileDescription {
  constructor(pipe, statusFlags) {
    super(O.READ | statusFlags);
    this.pipe = pipe;
  }

  readv(data, thread, totalLen) {
    if (!totalLen) return 0;
    if (this.flagNonBlocking) {
      // TODO: non-blocking read from pipe
      debugger;
      thread.requestUserDebugger();
      throw new InvalidError();
    } else {
      return this.pipe.queueRead({data, totalLen});
    }
  }

  dispose() {
    this.pipe.decNumOpenReaders();
  }
}

class PipeWriteEnd extends OpenFileDescription {
  constructor(pipe, statusFlags) {
    super(O.WRITE | statusFlags);
    this.pipe = pipe;
  }

  writev(data, thread, totalLen) {
    if (!totalLen) return 0;
    if (this.flagNonBlocking) {
      // TODO: non-blocking write to pipe
      debugger;
      thread.requestUserDebugger();
      throw new InvalidError();
    } else {
      return this.pipe.queueWrite({data, totalLen});
    }
  }

  dispose() {
    this.pipe.decNumOpenWriters();
  }
}

class PipeFS extends FileSystem {
  constructor() {
    super();
    // TODO: id = 1 reserved for a directory enumerating the pipes in the kernel
    this.idCounter = 2n;
    this.pipes = new Map();
  }

  createPipeLocation(pipe, mount) {
    const id = this.idCounter++;
    this.pipes.set(id, pipe);
    return new FIFOLocation(mount, id);
  }

  // TODO: this won't get called because we don't mark pipes as orphans
  // So we leak the pipe structure
  freeFileId(id) {
    this.pipes.delete(id);
  }

  // TODO: to support openat on a pipe, should implement openExisting

  stat(id, syncFlag, mask, thread) {
    void syncFlag, mask;
    if (id === 1n) {
      // TODO: root directory
      debugger;
      thread.requestUserDebugger();
      throw new InvalidError();
    } else {
      const pipe = this.pipes.get(id);
      // TODO: Intercept fstat for pipes at the open file description layer
      return {
        blksize: 1024,
        nlink: 1,
        uid: pipe.uid,
        gid: pipe.gid,
        mode: 0, // TODO
        size: 0n, // maybe todo
        blocks: 0n,
        atime: nullTimestamp,
        ctime: nullTimestamp,
        mtime: nullTimestamp,
        rdev: {major: 0, minor: 0},
      };
    }
  }
}
const pipeFS = new PipeFS();
const pipeMount = makeRootMount(pipeFS, 1n);

const nullTimestamp = {sec: 0n, nsec: 0};

const makePipe = ({nonblocking}, thread) => {
  let statusFlags = 0;
  if (nonblocking) statusFlags |= O.NONBLOCK;
  const pipe = new Pipe(thread.process.setUserId.effective, thread.process.setGroupId.effective);
  pipe.fileLoc = pipeFS.createPipeLocation(pipe, pipeMount);
  return [pipe.openNewReadEnd(statusFlags), pipe.openNewWriteEnd(statusFlags)];
};

export {makePipe, pipeFS};
