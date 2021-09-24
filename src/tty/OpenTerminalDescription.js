import {OpenFileDescription} from '../OpenFileDescription.js';

class OpenTerminalDescription extends OpenFileDescription {
  constructor(term) {
    super();
    this.term = term;
  }

  dispose() {
  }

  async ioctl(request, argp, dv) {
    if (await this.term.ioctl(request, argp, dv)) return 0;
    else return super.ioctl(request, argp, dv);
  }

  writev(data) {
    return this.term.writev(data);
  }

  readv(data) {
    return this.term.readv(data);
  }
}

export {OpenTerminalDescription};
