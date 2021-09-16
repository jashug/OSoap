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

// Used for CWD and root directory, as well as during the process
// of pathname resolution.
// Can be moved around; not an immutable type.
// Holds a virtual link in to the directory.
// Always points to a directory, never any other type of file.
class PlainDirectoryPointer {
  constructor(mount, id) {
    this.mount = mount;
    this.id = id;
    this.mount.fs.virtualLinksIn.inc(this.id);
  }

  copy() {
    return new PlainDirectoryPointer(this.mount, this.id);
  }

  // Always call dispose exactly once.
  dispose() {
    this.mount.fs.virtualLinksIn.dec(this.id);
    this.mount = null;
  }
}

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

export {PlainDirectoryPointer, OpenFileDescription, devConsole};
