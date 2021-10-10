import {TERMIOS_OFFSET, IFLG, OFLG, CFLG, LFLG, V, BAUD, _POSIX_VDISABLE} from '../constants/termios.js';
import {IOCTL} from '../constants/ioctl.js';
import {getWinSize} from '../ioctl/winsz.js';
import {Queue} from '../util/Queue.js';
import {getNonexistentProcessGroupId} from '../threadTable.js';

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

const NL_CHAR = '\n'.codePointAt(0);
const CR_CHAR = '\r'.codePointAt(0);
const CRNL_SEQ = new Uint8Array([CR_CHAR, NL_CHAR]);

const encoder = new TextEncoder();

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
    this.bytesInInputQueue = 0;
    this.currentLine = [];
    this.readWaiters = new Set();
    this._readyForReading = null;
  }

  // Consider asking for notification when the fg process group dies,
  // rather than handling it lazily here.
  get foregroundProcessGroup() {
    if (this._foregroundProcessGroup !== null && this._foregroundProcessGroup.session === null) {
      this._foregroundProcessGroup = null;
    }
    return this._foregroundProcessGroup;
  }

  set foregroundProcessGroup(rhs) {
    this._foreGroundProcessGroup = rhs;
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

  flush() {
    console.log("Flush!");
    this.inputQueue.clear();
    this.bytesInInputQueue = 0;
    this.currentLine = [];
  }

  get intrKey() { return this.cc[V.INTR]; }
  get quitKey() { return this.cc[V.QUIT]; }
  get eraseKey() { return this.cc[V.ERASE]; }
  get killKey() { return this.cc[V.KILL]; }
  get eofKey() { return this.cc[V.EOF]; }
  get swtcKey() { return this.cc[V.SWTC]; }
  get startKey() { return this.cc[V.START]; }
  get stopKey() { return this.cc[V.STOP]; }
  get suspKey() { return this.cc[V.SUSP]; }
  get eolKey() { return this.cc[V.EOL]; }
  get reprintKey() { return this.cc[V.REPRINT]; }
  get discardKey() { return this.cc[V.DISCARD]; }
  get weraseKey() { return this.cc[V.WERASE]; }
  get lnextKey() { return this.cc[V.LNEXT]; }
  get eol2Key() { return this.cc[V.EOL2]; }

  get ccTime() { return this.cc[V.TIME]; } // tenths of a second
  get ccMin() { return this.cc[V.MIN]; } // bytes

  getUSVStringInput(data) {
    if (data.length === 0) return;
    if (data.length > 100) {
      console.log("Some unexpectedly long data");
      debugger;
    }
    // enqueue processed data
    const toEcho = [];
    for (const c of data) {
      let dontEcho = false;
      const codePoint = c.codePointAt(0);
      if (this.lflag & LFLG.ISIG) {
        if (codePoint === this.intrKey && codePoint !== _POSIX_VDISABLE) {
          console.log("INTR!");
          if (!(this.lflag & LFLG.NOFLSH)) this.flush();
          // TODO: also stop the output in the middle, maybe
          dontEcho = true;
        } else if (codePoint === this.quitKey && codePoint !== _POSIX_VDISABLE) {
          console.log("QUIT!");
          if (!(this.lflag & LFLG.NOFLSH)) this.flush();
          dontEcho = true;
        } else if (codePoint === this.suspKey && codePoint !== _POSIX_VDISABLE) {
          console.log("SUSP!");
          if (!(this.lflag & LFLG.NOFLSH)) this.flush();
          dontEcho = true;
        }
      }
      if (this.iflag & IFLG.IXON) {
        if (codePoint === this.startKey && codePoint !== _POSIX_VDISABLE) {
          console.log("Start!");
          dontEcho = true;
        } else if (codePoint === this.stopKey && codePoint !== _POSIX_VDISABLE) {
          console.log("Stop!");
          dontEcho = true;
        }
      }
      if (this.lflag & LFLG.ICANON) {
        debugger;
      } else {
        this.enqueueInputCharacter(c);
      }
      if (!dontEcho && this.lflag & LFLG.IECHO) {
        toEcho.push(c);
      }
    }
    this.writeStringsBlocking(toEcho);
  }

  enqueueInputCharacter(c) {
    const arr = encoder.encode(c);
    this.inputQueue.enqueue(arr);
    this.bytesInInputQueue += arr.length;
    for (const waiter of this.readWaiters) waiter.check();
  }

  async readv(data, thread) {
    // TODO: worry about SIGTTIN
    const ccTime = this.ccTime;
    const ccMin = this.ccMin;
    if (ccTime !== 0) {
      debugger;
      thread.requestUserDebugger();
      await new Promise(() => {});
    } else {
      return new Promise((resolve) => {
        const outerThis = this;
        const inputQueue = this.inputQueue;
        const waiter = {
          check() {
            if (outerThis.bytesInInputQueue < ccMin) return;
            // Success!
            let bytesRead = 0;
            for (const arr of data) {
              let position = 0;
              while (inputQueue.size > 0) {
                const item = inputQueue.dequeue();
                if (position + item.length < arr.length) {
                  arr.set(item, position);
                  position += item.length;
                  bytesRead += item.length;
                } else {
                  const split = arr.length - position;
                  arr.set(item.subarray(0, split), position);
                  if (split < item.length) {
                    inputQueue.pushFront(arr.subarray(split));
                  }
                  bytesRead += split;
                  break;
                }
              }
            }
            outerThis.readWaiters.delete(this);
            outerThis.bytesInInputQueue -= bytesRead;
            resolve(bytesRead);
          },
        };
        this.readWaiters.add(waiter);
        waiter.check();
      });
    }
    void data;
  }

  readyForReading() {
    const ccTime = this.ccTime;
    const ccMin = this.ccMin;
    const effectiveMin = ccTime === 0 ? ccMin : Math.max(ccMin, 1);
    if (this.bytesInInputQueue >= effectiveMin) return true;
    if (this._readyForReading === null) {
      this._readyForReading = new Promise((resolve) => {
        const outerThis = this;
        const waiter = {
          check() {
            if (outerThis.bytesInInputQueue < effectiveMin) return;
            outerThis.readWaiters.delete(this);
            if (outerThis._readyForReading === currentReadyForReading) {
              outerThis._readyForReading = null;
            }
            resolve();
          },
        };
        this.readWaiters.add(waiter);
        waiter.check();
      });
      const currentReadyForReading = this._readyForReading;
    }
    return this._readyForReading;
  }

  drain() {
    // Drain doesn't have to do anything, unless writeBytesBlocking
    // does some postprocessing.
  }

  async writev(data, thread, totalLen) {
    // TODO: SIGTTOU
    void thread;
    if (this.oflag & OFLG.OPOST && this.oflag & ~OFLG.OPOST) {
      if (this.oflag & ~(OFLG.OPOST | OFLG.ONLCR)) {
        const oflagString = this.oflag.toString(8);
        void oflagString;
        debugger;
      } else if (this.oflag & OFLG.ONLCR) {
        // process nl into crnl
        const copiedData = [];
        for (const arr of data) {
          let startOfLine = 0;
          let endOfLine = arr.indexOf(NL_CHAR);
          while (endOfLine !== -1) {
            copiedData.push(new Uint8Array(arr.subarray(startOfLine, endOfLine)));
            copiedData.push(CRNL_SEQ);
            startOfLine = endOfLine + 1;
            endOfLine = arr.indexOf(NL_CHAR, startOfLine);
          }
          copiedData.push(new Uint8Array(arr.subarray(startOfLine)));
        }
        await this.writeBytesBlocking(copiedData);
        return totalLen;
      }
    } else {
      const copiedData = [];
      for (const arr of data) {
        copiedData.push(new Uint8Array(arr));
      }
      await this.writeBytesBlocking(copiedData);
      return totalLen;
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
    } else if (request === IOCTL.TIOC.GPGRP) {
      if (this.foregroundProcessGroup === null) {
        dv.setUint32(argp, getNonexistentProcessGroupId(), true);
      } else {
        dv.setUint32(argp, this.foregroundProcessGroup.processGroupId, true);
      }
    } else if (request === IOCTL.TIOC.SPGRP) {
      debugger;
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
    const oldMin = this.ccMin;
    this.iflag = dv.getUint32(argp + TERMIOS_OFFSET.iflag, true);
    this.oflag = dv.getUint32(argp + TERMIOS_OFFSET.oflag, true);
    this.cflag = dv.getUint32(argp + TERMIOS_OFFSET.cflag, true);
    this.lflag = dv.getUint32(argp + TERMIOS_OFFSET.lflag, true);
    const cc = new Uint8Array(dv.buffer, dv.byteOffset + argp + TERMIOS_OFFSET.cc_array, TERMIOS_OFFSET.cc_array_length);
    this.cc.set(cc);
    if (this.ccMin !== oldMin) this._readyForReading = null;
    console.log(`iflag: ${this.iflag.toString(8)}, oflag: ${this.oflag.toString(8)}, cflag: ${this.cflag.toString(8)}, lflag: ${this.lflag.toString(8)}`);
  }

  connectToSession(session) {
    session.controllingTerminal = this;
    this.session = session;
  }
}

export {Terminal};
