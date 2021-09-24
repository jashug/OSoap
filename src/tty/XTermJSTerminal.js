import {Terminal as KTerminal} from './Terminal.js';

class XTermJSTerminal extends KTerminal {
  constructor(div) {
    super();
    this.div = div;
    this.term  = new Terminal();
    this.term.open(this.div);
  }
}

export {XTermJSTerminal};
