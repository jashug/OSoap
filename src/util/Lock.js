// A very simple lock. May need to be improved in the future.
// No support for reader/writer.
// Not recursive.
// Non-cancellable.
// No timeout supported

import {Queue} from './Queue.js';

const alreadyUnlocked = () => {
  throw new Error("Attempt to unlock an unlocked lock");
};

class Lock {
  constructor() {
    this.waiters = new Queue();
    this.locked = false;
  }

  aquire() {
    if (this.locked) {
      return new Promise((resolve) => {
        this.waiters.enqueue(resolve);
      });
    } else {
      this.locked = true;
    }
  }

  release() {
    if (!this.locked) alreadyUnlocked();
    if (this.waiters.size) {
      const resolve = this.waiters.dequeue();
      resolve();
    } else {
      this.locked = false;
    }
  }

  async withLockAsync(f) {
    await this.aquire();
    try {
      return await f();
    } finally {
      this.release();
    }
  }

  async withLockSync(f) {
    await this.aquire();
    try {
      return f();
    } finally {
      this.release();
    }
  }
}

export {Lock};
