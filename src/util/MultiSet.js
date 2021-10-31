// TODO: optimize this code by removing a layer of indirection
// and using prototypal inheritance to directly manipulate a Map object.

class MultiSet {
  constructor() {
    this.counts = new Map();
  }

  inc(key) {
    const newCount = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, newCount);
    return newCount;
  }

  dec(key) {
    const newCount = this.counts.get(key) - 1;
    if (newCount === 0) this.counts.delete(key);
    else this.counts.set(key, newCount);
    return newCount;
  }
}

export {MultiSet};
