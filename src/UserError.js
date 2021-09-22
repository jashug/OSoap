/* UserError indicates that the user-space executable has behaved unexpectedly.
 * This is a placeholder for actual kernel-side error handling.
 * uses of throw new UserError() should be removed as implementation proceeds.
 */
class UserError extends Error {
  constructor(...args) {
    super(...args);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UserError);
    }
    this.name = 'UserError';
  }
}

class UserMisbehaved extends Error {
  constructor(...args) {
    super(...args);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UserError);
    }
    this.name = "UserMisbehaved";
  }
}

export {UserError};
