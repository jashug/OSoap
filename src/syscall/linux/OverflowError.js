import {makeErrorWithErrno} from '../../util/errorTemplate.js';
import {E} from './errno.js';

const OverflowError = makeErrorWithErrno("OverflowError", E.OVERFLOW);

export {OverflowError};
