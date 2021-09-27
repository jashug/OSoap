import {} from './checkEndianness.js';
import {spawnProcess, utf8Encoder} from './threadTable.js';
//import {devConsole} from './tty/devConsole.js';
import {XTermJSTerminal} from './tty/XTermJSTerminal.js';
import {OpenTerminalDescription} from './tty/OpenTerminalDescription.js';

const term = new XTermJSTerminal(document.getElementById('terminal'));
window.term = term;
// TODO: replace fitAddon with ResizeObserver

// FIXME: DECSET 1049: does not clear altbuffer
// https://github.com/xtermjs/xterm.js/issues/2669
// https://github.com/xtermjs/xterm.js/blob/c20c07c6d813e4a1120e03e971133fd70b7c2227/src/common/InputHandler.ts#L2137

// term.term.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m $ \r\nnew line\r\nthird line');
// term.term.write('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
//  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

// spawnProcess('/tmp/puts.wasm', new OpenTerminalDescription(term));
spawnProcess('/ncurses-test-programs/hanoi', new OpenTerminalDescription(term),
  [utf8Encoder.encode('hanoi'), utf8Encoder.encode('-X')],
);
/*spawnProcess('/tmp/argc.wasm', new OpenTerminalDescription(term),
  [utf8Encoder.encode('argc'), utf8Encoder.encode('hi'), utf8Encoder.encode('there')],
);*/

// TODO: normally in chrome, JS can't intercept ctrl-w, ctrl-n, ctrl-t
// In app mode, you can catch these keypresses.
// Use window.beforeunload to catch ctrl-w and warn the user that the page
// will close.
