import {TERMIOS_OFFSET, IFLG, OFLG, CFLG, LFLG, V, BAUD, _POSIX_VDISABLE} from '../constants/termios.js';
import {NoTTYError} from '../syscall/linux/NoTTYError.js';
import {IOCTL} from '../constants/ioctl.js';
import {getWinSize, setWinSize} from '../ioctl/winsz.js';
import {Queue} from '../util/Queue.js';
import {getNonexistentProcessGroupId} from '../threadTable.js';
import {PermissionError} from '../fs/errors.js';

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

// TODO: Investigate using Streams API

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
    this._foregroundProcessGroup = rhs;
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
    for (let c of data) {
      if (c === '\r' && this.iflag & IFLG.IGNCR && this.lflag & LFLG.ICANON) continue;
      if (c === '\r' && this.iflag & IFLG.ICRNL && this.lflag & LFLG.ICANON) c = '\n';
      if (c === '\n' && this.iflag & IFLG.INLCR && this.lflag & LFLG.ICANON) c = '\r';
      const codePoint = c.codePointAt(0);
      if (this.lflag & LFLG.ECHO) toEcho.push(c);
      if (codePoint !== _POSIX_VDISABLE) {
        if (this.lflag & LFLG.ISIG) {
          if (codePoint === this.intrKey) {
            console.log("INTR!");
            if (!(this.lflag & LFLG.NOFLSH)) this.flush();
            // TODO: also stop the output in the middle, maybe
            continue;
          } else if (codePoint === this.quitKey) {
            console.log("QUIT!");
            if (!(this.lflag & LFLG.NOFLSH)) this.flush();
            continue;
          } else if (codePoint === this.suspKey) {
            console.log("SUSP!");
            if (!(this.lflag & LFLG.NOFLSH)) this.flush();
            continue;
          }
        }
        if (this.iflag & IFLG.IXON) {
          if (codePoint === this.startKey) {
            console.log("Start!");
            continue;
          } else if (codePoint === this.stopKey) {
            console.log("Stop!");
            continue;
          }
        }
        if (this.lflag & LFLG.ICANON) {
          if (codePoint === this.eraseKey) {
            if (this.lflag & LFLG.ECHOE) {
              // TODO: do erase if line wrapping happens
              if (this.lflag & LFLG.ECHO) toEcho.pop();
              if (this.currentLine.pop()) toEcho.push('\b \b');
            }
            continue;
          } else if (codePoint === this.killKey) {
            console.log("kill");
            continue;
          } else if (codePoint === this.eofKey) {
            this.terminateLine();
            continue;
          } else if (codePoint === this.eolKey) {
            this.terminateLine(c);
            continue;
          } else if (c === '\n') {
            if (this.lflag & LFLG.ECHO) toEcho.pop();
            if (this.lflag & LFLG.ECHONL || this.lflag & LFLG.ECHO) {
              if (this.oflag & OFLG.ONLCR) toEcho.push('\r');
              toEcho.push('\n');
            }
            this.terminateLine(c);
            continue;
          } else {
            this.currentLine.push(c);
            continue;
          }
        }
      }
      this.enqueueInputCharacter(c);
    }
    this.writeStringsBlocking(toEcho);
  }

  terminateLine(eolChar) {
    if (eolChar) this.currentLine.push(eolChar);
    const str = this.currentLine.join('');
    this.currentLine = [];
    const arr = encoder.encode(str);
    this.inputQueue.enqueue(arr);
    this.bytesInInputQueue += arr.length;
    for (const waiter of this.readWaiters) waiter.check(true);
  }

  enqueueInputCharacter(c) {
    const arr = encoder.encode(c);
    this.inputQueue.enqueue(arr);
    this.bytesInInputQueue += arr.length;
    for (const waiter of this.readWaiters) waiter.check(false);
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
          check(lineComplete) {
            void lineComplete;
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
          check(lineComplete) {
            void lineComplete;
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
        // TODO
        debugger;
        thread.requestUserDebugger();
        throw new Error(`Unknown oflag ${oflagString}`);
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
      } else {
        throw new Error();
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
    } else if (request === IOCTL.TIOC.SWINSZ) {
      const requestedSize = setWinSize(argp, dv);
      // TODO: perform the update, and send SIGWINCH
      void requestedSize;
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
      if (this !== thread.process.controllingTerminal) throw new NoTTYError();
      const pgrp = this.foregroundProcessGroup?.processGroupId ?? getNonexistentProcessGroupId();
      dv.setBigInt64(argp, pgrp, true);
    } else if (request === IOCTL.TIOC.SPGRP) {
      if (this !== thread.process.controllingTerminal) throw new NoTTYError();
      const pgrp = dv.getBigInt64(argp, true);
      const pgrpObj = thread.process.processGroup.session.processGroups.get(pgrp);
      if (!pgrpObj) throw new PermissionError();
      this.foregroundProcessGroup = pgrpObj;
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
    // console.log(`iflag: ${this.iflag.toString(8)}, oflag: ${this.oflag.toString(8)}, cflag: ${this.cflag.toString(8)}, lflag: ${this.lflag.toString(8)}`);
  }

  connectToSession(session) {
    session.controllingTerminal = this;
    this.session = session;
  }
}

export {Terminal};
