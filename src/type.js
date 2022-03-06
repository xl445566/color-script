function checkBooleanType(value) {
  if (value === "true;" || value === "false;" || value[0] === "!") {
    return true;
  }

  return false;
}

function checkNumberType(value) {
  if (!isNaN(value.slice(0, -1)) && value !== ";") {
    return true;
  }

  const symbols = ["+", "-", "/", "*", "%", " ", "(", ")", "."];
  const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  let text = value;

  numbers.forEach((number) => {
    text = text.replaceAll(number, "");
  });

  symbols.forEach((symbol) => {
    text = text.replaceAll(symbol, "");
  });

  return text === ";" && value.trim() !== ";";
}

function checkStringType(value) {
  const startCharCode = value.charCodeAt(0);
  const endCharCode = value.charCodeAt(value.length - 2);
  const charCodes = [34, 39, 96];
  const isFinished = value.slice(-1) === ";";
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
  const hasSemicolon = value.slice(-1) === ";";

  if (hasSemicolon && value.slice(0, -1) === "null") {
    return true;
  }

  return false;
}

function checkUndefinedType(value) {
  const hasSemicolon = value.slice(-1) === ";";

  if (hasSemicolon && value.slice(0, -1) === "undefined") {
    return true;
  }

  return false;
}

function checkArrayType(value) {
  const hasSemicolon = value.slice(-1) === ";";
  const code = value.slice(0, -1).trim();
  const open = code.startsWith("[");
  const close = code.endsWith("]");

  if (hasSemicolon && open && close) {
    return true;
  }

  return false;
}

function checkObjectType(value) {
  const hasSemicolon = value.slice(-1) === ";";
  const code = value.slice(0, -1).trim();
  const open = code.startsWith("{");
  const close = code.endsWith("}");

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
