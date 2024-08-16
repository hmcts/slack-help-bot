const crypto = require("crypto");

// simple function to return a static hash of a string
// doesn't need to be secure just quick and simple
function hashString(str) {
  return crypto
    .createHmac("sha256", "123456789012345")
    .update(str)
    .digest("hex");
}

module.exports.hashString = hashString;
