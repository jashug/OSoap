const term = new Terminal();
term.open(document.getElementById('terminal'));
term.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m $ \r\nnew line\r\nthird line');

const testWorker = new Worker('src/worker.js', {type: 'module'});
window.testWorker = testWorker;
/*testWorker.postMessage({
  purpose: "process",
  module: "/tmp/puts.wasm",
  memory: {module: "env", name: "memory"},
});*/
