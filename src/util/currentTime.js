const currentTimespec = () => {
  const msSinceEpoch = Date.now();
  const secondsSinceEpoch = Math.floor(msSinceEpoch / 1000);
  const msLeftOver = msSinceEpoch - secondsSinceEpoch * 1000;
  if (msLeftOver < 0 || msLeftOver >= 1000) throw new Error("Problem with time math");
  const nsLeftOver = Math.floor(msLeftOver * 1000000);
  return {sec: BigInt(secondsSinceEpoch), nsec: nsLeftOver};
};

export {currentTimespec};
