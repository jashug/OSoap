// Takes an async function f and wraps f so that it is an error to call interleaved.
const oneAtATimeError = (f) => {
  let busy = false;
  return async (...args) => {
    if (busy) { throw new Error("Called twice interleaved"); }
    busy = true;
    try {
      return f(...args);
    } finally {
      busy = false;
    }
  };
};

const handleMessage = oneAtATimeError(async (e) => {
  const message = e.message;
  if (message.purpose == "process") {
    console.log("Start process");
  } else {
    throw new Error(`Unrecognized message purpose ${message.purpose}`);
  }
});
addEventListener("message", handleMessage);
