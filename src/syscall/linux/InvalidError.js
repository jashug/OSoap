import {makeErrorWithErrno} from '../../util/errorTemplate.js';
import {E} from './errno.js';

const InvalidError = makeErrorWithErrno("InvalidError", E.INVAL);

export {InvalidError};
