import {FMT} from '../constants/fs.js';
import {NoEntryError, NotADirectoryError} from './errors.js';
import {isDot, isDotDot} from './Path.js';

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
  const {followSymlinks = true, mustBeDirectory = false} = options;
  if (isDot(component)) return predecessor;
  try {
    if (isDotDot(component)) {
      return await predecessor.parentDirectory();
    }
    const childEntry = await predecessor.search(component);
    if (!followSymlinks) return childEntry;
    const fileType = childEntry.fileType;
    if (fileType === FMT.SYMLINK) {
      const linkContents = await childEntry.readlink();
      const result = await resolveToEntry(linkContents, predecessor, rootDir);
      if (mustBeDirectory) assertDirectory(result);
      return result;
    } else {
      if (mustBeDirectory) assertDirectory(childEntry);
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
  let predecessor = path.absolute ? rootDir : curDir;
  predecessor.incRefCount();
  for (const component of path.prefix) {
    predecessor = await walkComponent(component, predecessor, rootDir, {
      followSymlinks: options.followSymlinks,
      mustBeDirectory: true,
    });
  }
  return predecessor;
};

// Successfully resolves empty paths unless allowEmptyPath: false
const resolveToEntry = async (path, curDir, rootDir, options = {}) => {
  const {
    followPrefixSymlinks = true,
    followLastSymlink = true,
    allowEmptyPath = true,
  } = options;
  if (!allowEmptyPath && path.isEmptyPath()) {
    throw new NoEntryError();
  }
  const predecessorPromise = resolvePrefix(path, curDir, rootDir, {
    followSymlinks: followPrefixSymlinks,
  });
  if (path.lastComponent === null) {
    return predecessorPromise;
  }
  const predecessor = await predecessorPromise;
  const lastComponentPromise = walkComponent(
    path.lastComponent, predecessor, rootDir,
    {followSymlinks: followLastSymlink, mustBeDirectory: path.trailingSlash},
  );
  return lastComponentPromise;
};

const resolveParent = (path, curDir, rootDir, options = {}) => {
  const {followSymlinks = true, allowEmptyPath = true} = options;
  if (!allowEmptyPath && path.isEmptyPath()) {
    throw new NoEntryError();
  }
  return resolvePrefix(path, curDir, rootDir, {followSymlinks});
};

export {resolvePrefix, resolveToEntry, resolveParent};
