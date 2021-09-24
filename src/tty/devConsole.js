import {OpenFileDescription} from '../OpenFileDescriptor.js';
import {IOCTL} from '../constants/ioctl.js';
import {getWinSize} from '../ioctl/winsz.js';

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

  ioctl(request, argp, dv) {
    if (request === IOCTL.TIOC.GWINSZ) {
      getWinSize(argp, dv, {row: 25, col: 80, ypixel: 25 * 8, xpixel: 80 * 8});
      return 0;
    }
    return super.ioctl(request, argp, dv);
  }
}

const devConsole = new DevConsoleFileDescription();
devConsole.incRefCount(); // A never-released reference to this singleton.

export {devConsole};
