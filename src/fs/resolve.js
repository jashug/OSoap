import {FMT} from '../constants/fs.js';
import {NotADirectoryError} from './errors.js';
import {isDot, isDotDot} from './Path.js';

// Given a path and a current directory location and a root directory location,
// we can resolve a path.

// predecessor is owned, rootDir is borrowed, returns an owned reference.
const walkComponent = async (component, predecessor, rootDir, options = {}) => {
  const {followSymlinks = true} = options;
  if (isDot(component)) return predecessor;
  if (isDotDot(component)) {
    return predecessor.parentDirectory();
  }
  const childEntryPromise = predecessor.search(component);
  if (!followSymlinks) return childEntryPromise;

  const childEntry = await childEntryPromise;
  const fileType = childEntry.fileType;
  if (fileType === FMT.SYMLINK) {
    const linkContents = await childEntry.readlink();
    const resultPromise = resolveToEntry(linkContents, predecessor, rootDir);
    predecessor.decRefCount();
    return resultPromise;
  } else {
    predecessor.decRefCount();
    return childEntry;
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
    predecessor = await walkComponent(component, predecessor, rootDir, options);
    if (predecessor.fileType !== FMT.DIRECTORY) {
      predecessor.decRefCount();
      throw new NotADirectoryError();
    }
  }
  return predecessor;
};

// Successfully resolves empty paths
const resolveToEntry = async (path, curDir, rootDir, options = {}) => {
  const {followPrefixSymlinks = true, followLastSymlink = true} = options;
  const predecessorPromise = resolvePrefix(path, curDir, rootDir, {
    followSymlinks: followPrefixSymlinks,
  });
  if (path.lastComponent === null) {
    return predecessorPromise;
  }
  const predecessor = await predecessorPromise;
  return walkComponent(path.lastComponent, predecessor, rootDir, {
    followSymlinks: followLastSymlink,
  });
};

export {resolvePrefix, resolveToEntry};
