import {OpenFileDescription} from '../OpenFileDescription.js';

class OpenTerminalDescription extends OpenFileDescription {
  constructor(term) {
    super();
    this.term = term;
  }

  dispose() {
    this.term.flush();
  }

  async ioctl(request, argp, dv, thread) {
    if (await this.term.ioctl(request, argp, dv, thread)) return 0;
    else return super.ioctl(request, argp, dv, thread);
  }

  writev(data, thread, totalLen) {
    return this.term.writev(data, thread, totalLen);
  }

  readv(data, thread, totalLen) {
    return this.term.readv(data, thread, totalLen);
  }

  readyForReading() {
    return this.term.readyForReading();
  }

  readyForWriting() {
    return this.term.readyForWriting();
  }
}

export {OpenTerminalDescription};
