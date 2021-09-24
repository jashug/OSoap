import {OpenFileDescription} from '../OpenFileDescription.js';

class OpenTerminalDescription extends OpenFileDescription {
  constructor(term) {
    super();
    this.term = term;
  }

  dispose() {
  }

  ioctl(request, argp, dv) {
    if (this.term.ioctl(request, argp, dv)) return 0;
    else return super.ioctl(request, argp, dv);
  }

  writev(data) {
    debugger;
    void data;
  }

  readv(data) {
    debugger;
    void data;
  }
}

export {OpenTerminalDescription};
