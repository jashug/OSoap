import {} from './checkEndianness.js';
import {spawnProcess} from './threadTable.js';
//import {devConsole} from './tty/devConsole.js';
import {XTermJSTerminal} from './tty/XTermJSTerminal.js';
import {OpenTerminalDescription} from './tty/OpenTerminalDescription.js';

const term = new XTermJSTerminal(document.getElementById('terminal'));
// TODO: replace fitAddon with ResizeObserver

term.term.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m $ \r\nnew line\r\nthird line');
term.term.write('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

// spawnProcess('/tmp/puts.wasm', devConsole);
spawnProcess('/ncurses-test-programs/blue', new OpenTerminalDescription(term));
