import {makeErrorWithErrno} from '../util/errorTemplate.js';
import {E} from '../syscall/linux/errno.js';

const AccessError = makeErrorWithErrno("AccessError", E.ACCES);
const NotADirectoryError = makeErrorWithErrno("NotADirectoryError", E.NOTDIR);
const IsADirectoryError = makeErrorWithErrno("IsADirectoryError", E.ISDIR);
const NoEntryError = makeErrorWithErrno("NoEntryError", E.NOENT);
const ExistsError = makeErrorWithErrno("ExistsError", E.EXISTS);
const ReadOnlyFilesystemError = makeErrorWithErrno("ReadOnlyFilesystemError", E.ROFS);
const PermissionError = makeErrorWithErrno("PermissionError", E.PERM);
const LoopError = makeErrorWithErrno("LoopError", E.LOOP);

export {
  AccessError,
  NotADirectoryError,
  IsADirectoryError,
  NoEntryError,
  ExistsError,
  ReadOnlyFilesystemError,
  PermissionError,
  LoopError,
};
