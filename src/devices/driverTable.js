import {makeErrorWithErrno} from '../util/errorTemplate.js';
import {E} from '../syscall/linux/errno.js';

const NXIOError = makeErrorWithErrno("NXIOError", E.NXIO);

const driverTable = new Map();

const registerDriver = (major, driver) => {
  if (driverTable.has(major)) throw new Error(`double register of driver number ${major}`);
  driverTable.set(major, driver);
};

const getDynamicMajor = (() => {
  let openDynamicNumber = 254;
  return () => {
    const toReturn = openDynamicNumber;
    openDynamicNumber--;
    if (openDynamicNumber === 233) openDynamicNumber = 511;
    else if (openDynamicNumber === 383) throw new Error("Out of dynamic driver major number space");
    return toReturn;
  };
})();

const registerDriverDynamicMajor = (driver) => {
  const major = getDynamicMajor();
  registerDriver(major, driver);
  return major;
};

const getDriver = (major) => {
  const driver = driverTable.get(major);
  if (driver) return driver;
  debugger;
  throw new NXIOError();
};

export {registerDriver, registerDriverDynamicMajor, getDriver, NXIOError};
