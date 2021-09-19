import {} from './checkEndianness.js';
import {spawnProcess} from './threadTable.js';

const term = new Terminal();
/*const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);*/

// TODO: replace fitAddon with ResizeObserver

term.open(document.getElementById('terminal'));
//fitAddon.fit();

term.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m $ \r\nnew line\r\nthird line');
term.write('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

// spawnProcess('/tmp/puts.wasm');
spawnProcess('/ncurses-test-programs/blue');
