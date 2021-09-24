import {Terminal as KTerminal} from './Terminal.js';
import {OFLG} from '../constants/termios.js';

/*const writevToString = (data) => {
  const decoder = new TextDecoder();
  const strings = [];
  for (const arr of data) strings.push(decoder.decode(new Uint8Array(arr), {stream: true}));
  return strings.join('');
};*/

class XTermJSTerminal extends KTerminal {
  constructor(div) {
    super();
    this.div = div;
    this.term  = new Terminal();
    this.term.open(this.div);
  }

  drain() {
    return new Promise((resolve) => this.term.write("", resolve));
  }

  flush() {
    debugger;
  }

  writev(data) {
    if (this.oflags & OFLG.OPOST && this.oflags & ~OFLG.OPOST) {
      debugger;
      // TODO: processing of the output stream!
    }
    // TODO: Add flow control!
    for (const arr of data) this.term.write(new Uint8Array(arr));
  }

  readv(data) {
    debugger;
    void data;
  }
}

export {XTermJSTerminal};
