import {SYSBUF_OFFSET} from '../../constants/syscallBufferLayout.js';

const writev = (dv, process) => {
  const fd = dv.getInt32(process.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 0, true);
  const iov = dv.getUint32(process.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 1, true);
  const iovcnt = dv.getInt32(process.sysBufAddr + SYSBUF_OFFSET.linux_syscall.args + 4 * 2, true);
  // TODO: error handling
  // TODO: filesystem
  let bytes_written = 0;
  const strings = [];
  const decoder = new TextDecoder(); // TODO: Should be shared over multiple calls, maybe? How do partial writes of utf8 data work?
  for (let i = 0; i < iovcnt; i++) {
    const iov_base = dv.getUint32(iov + i * 8, true);
    const iov_len = dv.getUint32(iov + i * 8 + 4, true);
    strings.push(decoder.decode(new Uint8Array(new Uint8Array(dv.buffer, iov_base, iov_len)), {stream: true}));
    bytes_written += iov_len;
  }
  console.log(strings.join(''));
  return bytes_written;
};

export {writev};
