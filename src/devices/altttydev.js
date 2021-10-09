import {registerDriver, NXIOError} from './driverTable.js';
import {OpenTerminalDescription} from '../tty/OpenTerminalDescription.js';

const devTTY = {
  open(flags, thread) {
    const term = thread.process.processGroup.session.controllingTerminal;
    if (term === null) throw new NXIOError();
    return new OpenTerminalDescription(term);
  },
};

const minorTable = new Map([
  [0, devTTY],
]);

const getMinorDriver = (minor) => {
  const driver = minorTable.get(minor);
  if (driver) return driver;
  debugger;
  throw new NXIOError();
};

registerDriver(5, {
  open(minor, ...args) {
    return getMinorDriver(minor).open(...args);
  },
});
