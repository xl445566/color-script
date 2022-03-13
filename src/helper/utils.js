const constants = require("./constants");

function cloneDeep(obj) {
  if (obj === null || typeof obj !== constants.OBJECT) {
    return obj;
  }

  const result = Array.isArray(obj) ? [] : {};

  for (let key of Object.keys(obj)) {
    result[key] = cloneDeep(obj[key]);
  }

  return result;
}

exports.cloneDeep = cloneDeep;
