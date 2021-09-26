// A very simple lock. May need to be improved in the future.
// No support for reader/writer.
// Not recursive.
// Non-cancellable.

const alreadyUnlocked = () => {
  throw new Error("Attempt to unlock an unlocked lock");
};

class Lock {
  constructor() {
    this.unlocked = Promise.resolve();
    this._unlock = alreadyUnlocked;
    this.locked = false;
  }

  async aquire() {
    while (this.locked) await this.unlocked;
    this._aquire();
  }

  // Must only be called when !this.locked
  _aquire() {
    if (this.locked) throw new Error("Attempting synchronous locking of locked lock");
    this.unlocked = new Promise((resolve) => {
      this._unlock = resolve;
    });
    this.locked = true;
  }

  release() {
    if (!this.locked) alreadyUnlocked();
    this.locked = false;
    this._unlock();
  }

  async withLockAsync(f) {
    while (this.locked) await this.unlocked;
    this._aquire();
    try {
      return await f();
    } finally {
      this.release();
    }
  }

  async withLockSync(f) {
    while (this.locked) await this.unlocked;
    this._aquire();
    try {
      return f();
    } finally {
      this.release();
    }
  }
}

export {Lock};
