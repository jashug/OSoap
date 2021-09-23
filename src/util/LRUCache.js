// From https://stackoverflow.com/a/46432113/2644368
class LRUCache {
  constructor(max = 10) {
    this.max = max;
    this.cache = new Map();
  }

  get(key) {
    let item = this.cache.get(key);
    if (item) {
      // refresh key
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }

  set(key, val) {
    // refresh key
    if (this.cache.has(key)) this.cache.delete(key);
    // evict oldest
    else if (this.cache.size >= this.max) this.cache.delete(this.first());
    this.cache.set(key, val);
  }

  delete(key) {
    this.cache.delete(key);
  }

  first() {
    return this.cache.keys().next().value;
  }
}

export {LRUCache};
