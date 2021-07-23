import {instantiateWithMemory} from './instantiate_with_memory.js';
const term = new Terminal();
term.open(document.getElementById('terminal'));
term.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m $ \r\nnew line\r\nthird line');

const justMathModule = await WebAssembly.compileStreaming(fetch('tmp/just_math.wasm'));
const justMathInstance = await instantiateWithMemory(justMathModule, {env: {}}, {namespace: 'env', name: 'memory'});
console.log(WebAssembly.Module.imports(justMathModule));
