import {UserMisbehaved} from '../UserError.js';
import {E} from '../syscall/linux/errno.js';
import {utf8Encoder} from '../util/utf8Encoder.js';

const PATH_MAX = 4096; // from limits.h

const SLASH_CODE = '/'.charCodeAt(0);
const nonSlashChar = (c) => c !== SLASH_CODE;

const DOT_CODE = '.'.charCodeAt(0);
const isDot = (component) => component.length === 1 && component[0] === DOT_CODE;
const isDotDot = (component) => {
  return component.length === 2 &&
    component[0] === DOT_CODE && component[1] === DOT_CODE;
};

const equalComponents = (lhs, rhs) => {
  if (lhs === rhs) return true;
  if (lhs.length !== rhs.length) return false;
  return lhs.every((element, index) => element === rhs[index]);
};
const componentToBinaryString = (component) => {
  return String.fromCharCode.apply(null, component);
};
const binaryStringToComponent = (string) => {
  return Uint8Array.from(string, (char) => char.charCodeAt(0));
};
const laxUTF8Decoder = new TextDecoder();
const componentDecoder = new TextDecoder('utf-8', {fatal: true});
const componentToUTF8String = (component) => {
  try {
    return componentDecoder.decode(component);
  } catch (e) {
    if (e instanceof TypeError) {
      // Not valid UTF-8
      return null;
    } else throw e;
  }
};
const attemptComponentToUTF8String = (component) => {
  return laxUTF8Decoder.decode(component);
};
const UTF8StringToComponent = (string) => utf8Encoder.encode(string);

class Path {
  constructor(absolute, prefix, lastComponent, trailingSlash) {
    this.absolute = absolute;
    this.prefix = prefix;
    this.lastComponent = lastComponent;
    // if lastComponent is null, trailingSlash should be false and this.prefix.length should be 0
    this.trailingSlash = trailingSlash;
  }

  isEmptyPath() {
    return !this.absolute && this.lastComponent === null;
  }

  toString() {
    const parts = [];
    if (this.absolute) parts.push('/');
    for (const component of this.prefix) {
      parts.push(attemptComponentToUTF8String(component));
      parts.push('/');
    }
    if (this.lastComponent !== null) {
      parts.push(attemptComponentToUTF8String(this.lastComponent));
      if (this.trailingSlash) parts.push('/');
    }
    return parts.join('');
  }
}

class PathTooLongError extends Error {
  constructor(...args) {
    super(...args);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PathTooLongError);
    }
    this.name = "PathTooLongError";
    this.linuxSyscallErrno = E.NAMETOOLONG;
  }
}

// Pass in a SharedArrayBuffer
// Returns a Uint8Array on a new non-shared buffer that does not
// contain nul bytes.
const copyCString = (buffer, index) => {
  const possibleArea = new Uint8Array(buffer, index);
  const firstNul = possibleArea.indexOf(0);
  if (firstNul === -1 || firstNul > PATH_MAX) {
    throw new PathTooLongError();
  }
  const viewOnString = possibleArea.subarray(0, firstNul);
  const stringCopy = new Uint8Array(viewOnString);
  if (stringCopy.indexOf(0) !== -1) {
    throw new UserMisbehaved("User changing memory during syscall");
  }
  return stringCopy;
};

const pathFromString = (array) => {
  const firstComponentIndex = array.findIndex(nonSlashChar);
  if (firstComponentIndex === -1) {
    return new Path(array.length > 0, [], null, false);
  }
  const absolute = firstComponentIndex > 0;
  const prefix = [];
  let curComponentIndex = firstComponentIndex;
  while (true) {
    const nextSlashIndex = array.indexOf(SLASH_CODE, curComponentIndex);
    if (nextSlashIndex === -1) {
      return new Path(absolute, prefix, array.subarray(curComponentIndex), false);
    }
    const curComponent = array.subarray(curComponentIndex, nextSlashIndex);
    const numSlashes =
      array.subarray(nextSlashIndex).findIndex(nonSlashChar);
    if (numSlashes === -1) {
      return new Path(absolute, prefix, curComponent, true);
    }
    curComponentIndex = nextSlashIndex + numSlashes;
    prefix.push(curComponent);
  }
};

const pathFromCString = (buffer, index) => {
  return pathFromString(copyCString(buffer, index));
};

export {
  Path,
  copyCString,
  pathFromString,
  pathFromCString,
  isDot,
  isDotDot,
  equalComponents,
  componentToBinaryString,
  binaryStringToComponent,
  componentToUTF8String,
  UTF8StringToComponent,
};
