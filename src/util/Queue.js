class Queue {
  constructor() {
    this.front = [];
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
}

export {Queue};
