class Queue {
  constructor(init = []) {
    this.front = [...init];
    this.front.reverse();
    this.back = [];
  }

  get size() {
    return this.front.length + this.back.length;
  }

  enqueue(item) {
    this.back.push(item);
  }

  dequeue() {
    if (this.front.length === 0) {
      while (this.back.length > 0) {
        this.front.push(this.back.pop());
      }
    }
    return this.front.pop();
  }

  pushFront(item) {
    this.front.push(item);
  }

  clear() {
    this.front = [];
    this.back = [];
  }
}

class ScatteredByteQueue {
  constructor() {
    this.queue = new Queue();
    this.bytesInQueue = 0;
  }

  get size() {
    return this.bytesInQueue;
  }

  consume(len, out = []) {
    if (len > this.size) throw new Error("Attempt to consume more than available");
    while (this.bytesInQueue) {
      const arr = this.queue.dequeue();
      this.bytesInQueue -= arr.length;
      if (arr.length <= len) {
        // Totally consume arr
        out.push(arr);
        len -= arr.length;
      } else {
        // Partially consume arr
        out.push(arr.subarray(0, len));
        const newArr = arr.subarray(len);
        this.bytesInQueue += newArr.length;
        this.queue.pushFront(newArr);
        break;
      }
    }
    return out;
  }

  pushMulti(data) {
    for (const arr of data) this.push(arr);
  }

  push(arr) {
    if (!arr.length) return;
    this.queue.enqueue(arr);
    this.bytesInQueue += arr.length;
  }
}

export {Queue, ScatteredByteQueue};
