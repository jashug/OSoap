import {UserError} from './UserError.js';

// Takes an async function f and wraps f so that
// it is an error to call interleaved.
const oneAtATimeError = (f) => {
  let busy = false;
  return async (...args) => {
    if (busy) { throw new Error("Called twice interleaved"); }
    busy = true;
    try {
      return await f(...args);
    } finally {
      busy = false;
    }
  };
};

const once = (f) => {
  let called = false;
  return (...args) => {
    if (called) throw new UserError(`Double call of ${f.name}`);
    return f(...args);
  };
};

export {once, oneAtATimeError};
