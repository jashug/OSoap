import {makeErrorWithErrno} from '../../util/errorTemplate.js';
import {E} from './errno.js';

const LinuxRangeError = makeErrorWithErrno("LinuxRangeError", E.RANGE);

export {LinuxRangeError};
