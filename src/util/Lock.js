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
  }

  async aquire() {
    await this.unlocked;
    this.unlocked = new Promise((resolve) => {
      this._unlock = () => {
        resolve();
        this._unlock = alreadyUnlocked;
      };
    });
  }

  release() {
    this._unlock();
  }

  async withLock(f) {
    await this.aquire();
    try {
      return await f();
    } finally {
      this.release();
    }
  }
}

export {Lock};
