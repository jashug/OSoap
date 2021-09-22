import {UserMisbehaved} from '../UserError.js';
import {E} from '../syscall/linux/errno.js';

const PATH_MAX = 4096; // from limits.h

const SLASH_CODE = '/'.charCodeAt(0);
const nonSlashChar = (c) => c !== SLASH_CODE;

const DOT_CODE = '.'.charCodeAt(0);
const isDot = (component) => component.length === 1 && component[0] === DOT_CODE;
const isDotDot = (component) => {
  return component.length === 2 &&
    component[0] === DOT_CODE && component[1] === DOT_CODE;
};

class Path {
  constructor(absolute, prefix, lastComponent, trailingSlash) {
    this.absolute = absolute;
    this.prefix = prefix;
    this.lastComponent = lastComponent;
    // if lastComponent is null, trailingSlash should be false
    this.trailingSlash = trailingSlash;
  }

  isEmptyPath() {
    return !this.absolute && this.prefix.length === 0 && this.lastComponent === null;
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
};
