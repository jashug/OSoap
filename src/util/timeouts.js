const INFINITE_TIMEOUT = {
  nonZero: true,
  toMSec() { return Infinity; },
};

class TimeVal {
  constructor(sec, usec) {
    this.sec = sec;
    this.usec = usec;
  }

  static read(dv, loc) {
    if (loc === 0) return INFINITE_TIMEOUT;
    return new TimeVal(dv.getInt32(loc + 0, true), dv.getInt32(loc + 4, true));
  }

  get nonZero() {
    return this.sec !== 0 || this.usec !== 0;
  }

  toMSec() {
    return this.sec * 1000 + this.usec / 1000;
  }
}

class TimeSpec {
  constructor(sec, nsec) {
    this.sec = sec;
    this.nsec = nsec;
  }

  static read(dv, loc) {
    if (loc === 0) return INFINITE_TIMEOUT;
    return new TimeSpec(dv.getInt32(loc + 0, true), dv.getInt32(loc + 4, true));
  }

  get nonZero() {
    return this.sec !== 0 || this.nsec !== 0;
  }

  toMSec() {
    return this.sec * 1000 + this.nsec / 1000000;
  }
}

export {TimeVal, TimeSpec, INFINITE_TIMEOUT};
