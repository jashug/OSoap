import {getDriver} from './driverTable.js';

const openDeviceFile = (devNum, ...args) => {
  const driver = getDriver(devNum.major);
  return driver.open(devNum.minor, ...args);
};

export {openDeviceFile};
