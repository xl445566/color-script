const constants = require("./constants");

function checkBooleanType(value) {
  if (
    value === constants.TRUE + constants.SEMI_COLON ||
    value === constants.FALSE + constants.SEMI_COLON ||
    value[0] === constants.EXCLAMATION_MARK
  ) {
    return true;
  }

  return false;
}

function checkNumberType(value) {
  if (!isNaN(value.slice(0, -1)) && value !== constants.SEMI_COLON) {
    return true;
  }

  const symbols = ["+", "-", "/", "*", "%", " ", "(", ")", "."];
  const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  let text = value;

  numbers.forEach((number) => {
    text = text.replaceAll(number, constants.NONE);
  });

  symbols.forEach((symbol) => {
    text = text.replaceAll(symbol, constants.NONE);
  });

  return text === constants.SEMI_COLON && value.trim() !== constants.SEMI_COLON;
}

function checkStringType(value) {
  const startCharCode = value.charCodeAt(0);
  const endCharCode = value.charCodeAt(value.length - 2);
  const charCodes = [34, 39, 96];
  const isFinished = value.slice(-1) === constants.SEMI_COLON;

  let temp = [];
  let charCodeCount = 0;

  if (
    charCodes.includes(startCharCode) &&
    charCodes.includes(endCharCode) &&
    startCharCode === endCharCode &&
    isFinished
  ) {
    return true;
  } else {
    for (let i = 0; i < value.length; i++) {
      const codeNumber = value.charCodeAt(i);

      if (charCodes.includes(codeNumber) && !temp.includes(codeNumber)) {
        temp.push(codeNumber);
        charCodeCount += 1;
      } else if (charCodes.includes(codeNumber) && temp.includes(codeNumber)) {
        const index = temp.indexOf(codeNumber);

        if (index > -1) {
          temp.splice(index, 1);
          charCodeCount -= 1;
        }
      }
    }

    if (!temp.length === charCodeCount && charCodes.includes(startCharCode)) {
      temp = [];
      charCodeCount = 0;
      return true;
    }
  }

  return false;
}

function checkNullType(value) {
  const hasSemicolon = value.slice(-1) === constants.SEMI_COLON;

  if (hasSemicolon && value.slice(0, -1) === constants.NULL) {
    return true;
  }

  return false;
}

function checkUndefinedType(value) {
  const hasSemicolon = value.slice(-1) === constants.SEMI_COLON;

  if (hasSemicolon && value.slice(0, -1) === constants.UNDEFINED) {
    return true;
  }

  return false;
}

function checkArrayType(value) {
  const hasSemicolon = value.slice(-1) === constants.SEMI_COLON;
  const code = value.slice(0, -1).trim();
  const open = code.startsWith(constants.ARRAY_START);
  const close = code.endsWith(constants.ARRAY_END);

  if (hasSemicolon && open && close) {
    return true;
  }

  return false;
}

function checkObjectType(value) {
  const hasSemicolon = value.slice(-1) === constants.SEMI_COLON;
  const code = value.slice(0, -1).trim();
  const open = code.startsWith(constants.OBJECT_START);
  const close = code.endsWith(constants.OBJECT_END);

  if (hasSemicolon && open && close) {
    return true;
  }

  return false;
}

exports.checkBooleanType = checkBooleanType;
exports.checkNumberType = checkNumberType;
exports.checkStringType = checkStringType;
exports.checkNullType = checkNullType;
exports.checkUndefinedType = checkUndefinedType;
exports.checkArrayType = checkArrayType;
exports.checkObjectType = checkObjectType;
