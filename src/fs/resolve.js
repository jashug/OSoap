import {FMT} from '../constants/fs.js';
import {NoEntryError, NotADirectoryError, LoopError} from './errors.js';
import {isDot, isDotDot, pathFromString} from './Path.js';
import {equalFileLocations} from './FileLocation.js';

const MAX_SYMLINK_COUNT = 100;
const MAX_SYMLINKS = () => {
  return {
    x: MAX_SYMLINK_COUNT,
    tick() {
      if (this.x <= 0) throw new LoopError();
      this.x--;
    },
  };
};

// Given a path and a current directory location and a root directory location,
// we can resolve a path.

const assertDirectory = (entry) => {
  if (entry.fileType !== FMT.DIRECTORY) {
    entry.decRefCount();
    throw new NotADirectoryError();
  }
};

// predecessor is consumed, rootDir is borrowed, returns an owned reference.
const walkComponent = async (component, predecessor, rootDir, options = {}) => {
  const {followSymlinks = true, symlinkFuel = MAX_SYMLINKS()} = options;
  if (isDot(component)) return predecessor;
  try {
    if (isDotDot(component)) {
      if (equalFileLocations(predecessor, rootDir)) return predecessor.incRefCount();
      return await predecessor.parentDirectory();
    }
    const childEntry = await predecessor.search(component);
    if (!followSymlinks) return childEntry;
    const fileType = childEntry.fileType;
    if (fileType === FMT.SYMLINK) {
      symlinkFuel.tick();
      const linkContents = await childEntry.readlink();
      const linkPath = pathFromString(linkContents);
      const result = await resolveToEntry(linkPath, predecessor, rootDir, {symlinkFuel}, (result) => {
        result.incRefCount();
        return result;
      });
      return result;
    } else {
      return childEntry;
    }
  } finally {
    predecessor.decRefCount();
  }
};

// curDir and rootDir may be OpenFileDescriptions,
// but before calling this they should be checked to be directories.
// Beware: curDir and rootDir may be returned directly as the predecessor
// from this function, so make sure they implement all necessary APIs.
// curDir and rootDir are both borrowed, returns an owned reference to
// a directory. path.lastComponent is not handled.
const resolvePrefix = async (path, curDir, rootDir, options = {}) => {
  const {
    followSymlinks = true,
    symlinkFuel = MAX_SYMLINKS(),
  } = options;
  let predecessor = path.absolute ? rootDir : curDir;
  predecessor.incRefCount();
  for (const component of path.prefix) {
    predecessor = await walkComponent(component, predecessor, rootDir, {
      followSymlinks,
      symlinkFuel,
    });
  }
  return predecessor;
};

// Successfully resolves empty paths unless allowEmptyPath: false
const resolveToEntry = async (path, curDir, rootDir, options, f) => {
  const {
    followPrefixSymlinks = true,
    followLastSymlink = true,
    allowEmptyPath = true,
    mustBeDirectory = false,
    symlinkFuel = MAX_SYMLINKS(),
  } = options;
  if (!allowEmptyPath && path.isEmptyPath()) {
    throw new NoEntryError();
  }
  const predecessor = await resolvePrefix(path, curDir, rootDir, {
    followSymlinks: followPrefixSymlinks,
    symlinkFuel,
  });
  const entry = path.lastComponent ?
    await walkComponent(
      path.lastComponent, predecessor, rootDir,
      {followSymlinks: followLastSymlink, mustBeDirectory: path.trailingSlash, symlinkFuel},
    ) : predecessor;
  if (path.trailingSlash || mustBeDirectory) assertDirectory(entry);
  try {
    return await f(entry);
  } finally {
    entry.decRefCount();
  }
};

const resolveParent = async (path, curDir, rootDir, options, f) => {
  const {followSymlinks = true, allowEmptyPath = true, symlinkFuel = MAX_SYMLINKS()} = options;
  if (!allowEmptyPath && path.isEmptyPath()) {
    throw new NoEntryError();
  }
  const parent = await resolvePrefix(path, curDir, rootDir, {followSymlinks, symlinkFuel});
  assertDirectory(parent);
  try {
    return await f(parent);
  } finally {
    parent.decRefCount();
  }
};

export {resolveToEntry, resolveParent};
