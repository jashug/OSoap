import {makeErrorWithErrno} from '../util/errorTemplate.js';
import {E} from '../syscall/linux/errno.js';

const AccessError = makeErrorWithErrno("AccessError", E.ACCES);
const NotADirectoryError = makeErrorWithErrno("NotADirectoryError", E.NOTDIR);
const NoEntryError = makeErrorWithErrno("NoEntryError", E.NOENT);
const ExistsError = makeErrorWithErrno("ExistsError", E.EXISTS);
const ReadOnlyFilesystemError = makeErrorWithErrno("ReadOnlyFilesystemError", E.ROFS);

export {
  AccessError,
  NotADirectoryError,
  NoEntryError,
  ExistsError,
  ReadOnlyFilesystemError,
};
