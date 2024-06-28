function checkSlackResponseError(res, message) {
  if (!res.ok) {
    throw new Error(message + ": " + JSON.stringify(res));
  }
}

module.exports.checkSlackResponseError = checkSlackResponseError;
