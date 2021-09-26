import {TERMIOS_OFFSET, IFLG, OFLG, CFLG, LFLG, V, BAUD, _POSIX_VDISABLE} from '../constants/termios.js';
import {IOCTL} from '../constants/ioctl.js';
import {getWinSize} from '../ioctl/winsz.js';
import {Queue} from '../util/Queue.js';

const default_iflag = (
  IFLG.BRKINT | // breaks cause an interrupt signal
  IFLG.ICRNL | // translate carriage return to newline
  IFLG.IMAXBEL | // beep and do not flush a full input buffer on a character
0);
const default_oflag = (
  OFLG.OPOST | // postprocess output
  OFLG.ONLCR | // translate newline to carriage return newline
0);
const default_cflag = (
  CFLG.CREAD | // allow input to be recieved
0);
const default_lflag = (
  LFLG.ICANON | // enable special characters erase, kill, werase, reprint
  LFLG.IEXTEN | // enable non-POSIX special characters
  LFLG.ECHO | // echo input characters
  LFLG.ECHOE | // echo erase characters as backspace space backspace
  LFLG.ECHOK | // echo a newline after a kill character
  LFLG.ISIG | // enable interrupt, quit, and suspend special characters
  // LFLG.ECHOCTL | // echo control characters in hat notation
  // LFLG.ECHOKE | // kill all lines by obeying the echocrt and echoe settings
  LFLG.TOSTOP | // send SIGTTOU
0);

const defaultControlCharacters = new Uint8Array(TERMIOS_OFFSET.cc_array_length);
defaultControlCharacters[V.INTR] = 3; // ^C
defaultControlCharacters[V.QUIT] = 28; // ^\
defaultControlCharacters[V.ERASE] = 127; // ^? // maybe ^H = 8 instead?
defaultControlCharacters[V.KILL] = 21; // ^U
defaultControlCharacters[V.EOF] = 4; // ^D
defaultControlCharacters[V.SWTC] = _POSIX_VDISABLE;
defaultControlCharacters[V.START] = 17; // ^Q
defaultControlCharacters[V.STOP] = 19; // ^S
defaultControlCharacters[V.SUSP] = 26; // ^Z
defaultControlCharacters[V.EOL] = _POSIX_VDISABLE;
defaultControlCharacters[V.REPRINT] = 18; // ^R
defaultControlCharacters[V.DISCARD] = 15; // ^O
defaultControlCharacters[V.WERASE] = 23; // ^W
defaultControlCharacters[V.LNEXT] = 22; // ^V
defaultControlCharacters[V.EOL2] = _POSIX_VDISABLE;
defaultControlCharacters[V.TIME] = 0;
defaultControlCharacters[V.MIN] = 1;

class Terminal {
  constructor() {
    this._foregroundProcessGroup = null;
    this.session = null;
    this.iflag = default_iflag;
    this.oflag = default_oflag;
    this.cflag = default_cflag;
    this.lflag = default_lflag;
    this.cc = new Uint8Array(defaultControlCharacters);
    this.inputQueue = new Queue();
  }

  // Consider asking for notification when the fg process group dies,
  // rather than handling it lazily here.
  get foregroundProcessGroup() {
    if (this._foregroundProcessGroup.session === null) {
      this._foregroundProcessGroup = null;
    }
    return this._foregroundProcessGroup;
  }

  get rows() { return 25; }
  get cols() { return 80; }
  get ypixel() { return this.row * 8; }
  get xpixel() { return this.col * 8; }
  get size() {
    const row = this.rows;
    const col = this.col;
    return {row, col, ypixel: this.ypixel, xpixel: this.xpixel};
  }

  getUSVStringInput(data) {
    if (data.length === 0) return;
    if (data.length > 100) {
      console.log("Some unexpectedly long data");
      debugger;
    }
    console.log(JSON.stringify(data));
    // enqueue processed data
    for (const c of data) {
    }
  }

  async readv(data, thread) {
    // TODO: worry about SIGTTIN
    await new Promise(() => {});
    debugger;
    thread.requestUserDebugger();
    void data;
  }

  readyForReading() {
    return Boolean(this.inputQueue.size > 0);
  }

  async writev(data, thread) {
    // TODO: SIGTTOU
    void thread;
    if (this.oflags & OFLG.OPOST && this.oflags & ~OFLG.OPOST) {
      const oflagsString = this.oflags.toString(8);
      void oflagsString;
      debugger;
      // TODO: processing the output stream
    } else {
      const copiedData = [];
      for (const arr of data) {
        copiedData.push(new Uint8Array(arr));
      }
      await this.writeBytesBlocking(copiedData);
    }
  }

  readyForWriting() {
    // Override in subclass if terminal can block indefinitely.
    return true;
  }

  // returns true if it was able to process request,
  // false if should fall back
  async ioctl(request, argp, dv, thread) {
    if (request === IOCTL.TIOC.GWINSZ) {
      getWinSize(argp, dv, this.size);
    } else if (request === IOCTL.TC.GETS) {
      // get termios
      this.getTermios(argp, dv);
    } else if (request === IOCTL.TC.SETS) {
      // set termios
      this.setTermios(argp, dv, thread);
    } else if (request === IOCTL.TC.SETSW) {
      // set termios with drain
      await this.drain();
      this.setTermios(argp, dv, thread);
    } else if (request === IOCTL.TC.SETSF) {
      // set termios with drain and flush
      await this.drain();
      this.flush();
      this.setTermios(argp, dv, thread);
    } else {
      return false;
    }
    return true;
  }

  getTermios(argp, dv) {
    dv.setUint32(argp + TERMIOS_OFFSET.iflag, this.iflag, true);
    dv.setUint32(argp + TERMIOS_OFFSET.oflag, this.oflag, true);
    dv.setUint32(argp + TERMIOS_OFFSET.cflag, this.cflag, true);
    dv.setUint32(argp + TERMIOS_OFFSET.lflag, this.lflag, true);
    const cc = new Uint8Array(dv.buffer, dv.byteOffset + argp + TERMIOS_OFFSET.cc_array, TERMIOS_OFFSET.cc_array_length);
    cc.set(this.cc);
    dv.setUint32(argp + TERMIOS_OFFSET.ispeed, BAUD.B4000000, true);
    dv.setUint32(argp + TERMIOS_OFFSET.ospeed, BAUD.B4000000, true);
  }

  setTermios(argp, dv, thread) {
    void thread; // TODO: SIGTTOU
    this.iflag = dv.getUint32(argp + TERMIOS_OFFSET.iflag, true);
    this.oflag = dv.getUint32(argp + TERMIOS_OFFSET.oflag, true);
    this.cflag = dv.getUint32(argp + TERMIOS_OFFSET.cflag, true);
    this.lflag = dv.getUint32(argp + TERMIOS_OFFSET.lflag, true);
    const cc = new Uint8Array(dv.buffer, dv.byteOffset + argp + TERMIOS_OFFSET.cc_array, TERMIOS_OFFSET.cc_array_length);
    this.cc.set(cc);
    console.log(`iflag: ${this.iflag.toString(8)}, oflag: ${this.oflag.toString(8)}, cflag: ${this.cflag.toString(8)}, lflag: ${this.lflag.toString(8)}`);
  }
}

export {Terminal};
