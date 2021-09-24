import {TERMIOS_OFFSET, IFLG, OFLG, CFLG, LFLG, V, _POSIX_VDISABLE} from '../constants/termios.js';
import {IOCTL} from '../constants/ioctl.js';
import {getWinSize} from '../ioctl/winsz.js';

const default_iflag = (
  IFLG.BRKINT | // breaks cause an interrupt signal
  IFLG.ICRNL | // translate carriage return to newline
  IFLG.IMAXBEL | // beep and do not flush a full input buffer on a character
0);
const default_oflag = (
  OFLG.OPOST | // postprocess output
  OFLG.ONLCR | // translate newline to newline carriage return
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
  }

  // Consider asking for notification when the fg process group dies,
  // rather than handling it lazily here.
  get foregroundProcessGroup() {
    if (this._foregroundProcessGroup.session === null) {
      this._foregroundProcessGroup = null;
    }
    return this._foregroundProcessGroup;
  }

  get size() {
    return {row: 25, col: 80, ypixel: 25 * 8, xpixel: 80 * 8};
  }

  // returns true if it was able to process request,
  // false if should fall back
  ioctl(request, argp, dv) {
    if (request === IOCTL.TIOC.GWINSZ) {
      getWinSize(argp, dv, this.size);
    } else if (request === IOCTL.TC.GETS) {
      debugger;
    } else {
      return false;
    }
    return true;
  }
}

export {Terminal};
