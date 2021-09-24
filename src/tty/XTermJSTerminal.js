import {Terminal as KTerminal} from './Terminal.js';

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
    // TODO: processing of the output stream!
    // TODO: Add flow control!
    for (const arr of data) this.term.write(arr);
  }

  readv(data) {
    debugger;
    void data;
  }
}

export {XTermJSTerminal};
