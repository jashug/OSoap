import {makeErrorWithErrno} from '../../util/errorTemplate.js';
import {E} from './errno.js';

const NoTTYError = makeErrorWithErrno("NoTTYError", E.NOTTY);

export {NoTTYError};
