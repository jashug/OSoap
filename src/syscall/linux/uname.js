import {version} from '../../version.js';
import {utf8Encoder} from '../../util/utf8Encoder.js';

const UNAME_BUF_SIZE = 65;

const SYSNAME = 0 * UNAME_BUF_SIZE;
const NODENAME = 1 * UNAME_BUF_SIZE;
const RELEASE = 2 * UNAME_BUF_SIZE;
const VERSION = 3 * UNAME_BUF_SIZE;
const MACHINE = 4 * UNAME_BUF_SIZE;
const DOMAINNAME = 5 * UNAME_BUF_SIZE;

const sysname = utf8Encoder.encode('OSoap');
const nodename = utf8Encoder.encode('guest');
const machine = utf8Encoder.encode('Browser (TODO: which?)');
const domainname = utf8Encoder.encode('none');

const uname = (sysbuf, thread) => {
  void thread;
  const buf = sysbuf.linuxSyscallArg(0).getPtr();
  const writeCString = (offset, value) => {
    const arr = sysbuf.subUint8Array(buf + offset, UNAME_BUF_SIZE);
    if (value.length >= UNAME_BUF_SIZE) value = value.subarray(0, UNAME_BUF_SIZE - 1);
    arr.set(value);
    arr[value.length] = 0;
  };
  writeCString(SYSNAME, sysname);
  writeCString(NODENAME, nodename);
  writeCString(RELEASE, utf8Encoder.encode(version.release));
  writeCString(VERSION, utf8Encoder.encode(version.version));
  writeCString(MACHINE, machine);
  writeCString(DOMAINNAME, domainname);
  return 0;
};

export {uname};
