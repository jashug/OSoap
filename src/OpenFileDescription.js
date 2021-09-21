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

/* Interface for OpenFileDescription:
 * writev
 * fstat
 *   (virtual file descriptors should still try to put something
 *    unique-ish in st_dev and st_ino)
 *   devices should return the st_dev and st_ino of the file they
 *   were opened from in the filesystem.
 * dispose - called automatically when refCount goes to 0
 * search - looks up a directory entry
 */
class OpenFileDescription {
  constructor() {
    this.refCount = 0;
  }

  decRefCount() {
    if (this.refCount <= 0) throw new Error("Decrement zero refCount");
    if (--this.refCount === 0) {
      this.dispose();
    }
  }

  incRefCount() {
    if (this.refCount < 0) throw new Error("Increment negative refCount");
    this.refCount++;
  }

  // TODO: this is a stub
  dispose() {
    console.log("Open File Description being released");
  }
}

class DevConsoleFileDescription extends OpenFileDescription {
  // data is a Uint8Array of utf8 data
  writev(data) {
    // TODO: add error checking (invalid utf8 data, for example)
    const strings = [];
    const decoder = new TextDecoder(); // TODO: should maybe be shared over multiple calls
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

  dispose() {
    throw new Error("DevConsole should never be disposed");
    // We keep a reference to the singleton, and never release it,
    // so if we throw this error it indicates a double-free bug somewhere else.
  }
}

const devConsole = new DevConsoleFileDescription();
devConsole.incRefCount(); // A never-released reference to this singleton.

export {OpenFileDescription, devConsole};
