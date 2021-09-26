import {OpenFileDescription} from '../OpenFileDescription.js';

class OpenTerminalDescription extends OpenFileDescription {
  constructor(term) {
    super();
    this.term = term;
  }

  dispose() {
  }

  async ioctl(request, argp, dv, thread) {
    if (await this.term.ioctl(request, argp, dv, thread)) return 0;
    else return super.ioctl(request, argp, dv, thread);
  }

  writev(data, thread) {
    return this.term.writev(data, thread);
  }

  readv(data, thread) {
    return this.term.readv(data, thread);
  }

  readyForReading() {
    return this.term.readyForReading();
  }

  readyForWriting() {
    return this.term.readyForWriting();
  }
}

export {OpenTerminalDescription};
