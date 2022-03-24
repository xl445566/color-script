const constants = require("./constants");

function findValueInKeyFromStringTypeObject(keys, stringObj) {
  const results = [];
  let copyStringObj = stringObj;
  let hasKey = true;

  keys.forEach((key) => {
    if (copyStringObj.includes(key) && hasKey) {
      const keyStartIndex = copyStringObj.indexOf(key);
      const keyEndIndex = keyStartIndex + key.length;
      const colonIndex = copyStringObj.indexOf(constants.COLON, keyEndIndex);

      const value = copyStringObj
        .substring(colonIndex)
        .slice(1)
        .split(constants.COMMA)[0];

      results.push(value.trim());
      copyStringObj = copyStringObj.substring(colonIndex);
    } else {
      hasKey = false;
    }
  });

  return hasKey ? results : null;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

exports.findValueInKeyFromStringTypeObject = findValueInKeyFromStringTypeObject;
exports.sleep = sleep;
