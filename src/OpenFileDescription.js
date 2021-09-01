/*
// Performs the same purpose as Linux struct file.f_mode
// TODO: Make sure these flags are all useful
class FileMode {
  constructor() {
    this.readable = false;
    this.writable = false;
    this.seekable = false;
    this.executable = false;
    this.mayeagain = false;
  }
}

class FileFlags {
  constructor() {
    this.append = false;
    this.nonblock = false;
    this.dsync = false;
    this.rsync = false;
    this.sync = false;
    this.noatime = false;
  }
}
*/

// Subclasses should define close,
// and probably other methods for reading and writing.
class OpenFileDescription {
  constructor() {
    this.refcount = 0;
  }

  decRefCount() {
    if (this.refcount <= 0) throw new Error("Decrement zero refcount");
    if (--this.refcount === 0) {
      this.dispose();
    }
  }

  incRefCount() {
    if (this.refcount < 0) throw new Error("Increment negative refcount");
    this.refcount++;
  }

  // TODO: this is a stub
  dispose() {
    console.log("Open File Description being released");
  }

  // TODO: this is a stub
  // data is an array of Uint8Array
  writev(data) {
    const strings = [];
    const decoder = new TextDecoder(); // TODO: should be shared over multiple calls
    let bytes_written = 0;
    for (const arr of data) {
      // FIXME: the copy via new Uint8Array(arr) here is necessary because
      // TextDecoder.decode does not accept SharedArrayBuffer yet.
      // See browser bugs at https://github.com/whatwg/encoding/pull/182#issuecomment-539932294
      strings.push(decoder.decode(new Uint8Array(arr), {stream: true}));
      bytes_written += arr.length;
    }
    console.log(strings.join(''));
    return bytes_written;
  }
}

export {OpenFileDescription};
