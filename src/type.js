function checkBooleanType(value) {
  if (value === "true;" || value === "false;" || value.includes("!")) {
    return true;
  }

  return false;
}

function checkNumberType(value) {
  if (!isNaN(value.slice(0, -1))) {
    return true;
  }

  const symbols = ["+", "-", "/", "*", "%", " ", "(", ")", "."];
  const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  let text = value;

  console.log("\n");
  console.log("text", text);

  numbers.forEach((number) => {
    text = text.replaceAll(number, "");
  });

  symbols.forEach((symbol) => {
    text = text.replaceAll(symbol, "");
  });

  return text === ";";
}

function checkStringType(value) {
  const startCharCode = value.charCodeAt(0);
  const endCharCode = value.charCodeAt(value.length - 2);
  const charCodes = [34, 39, 96];
  const isFinished = value.slice(-1) === ";";

  if (
    charCodes.includes(startCharCode) &&
    charCodes.includes(endCharCode) &&
    startCharCode === endCharCode &&
    isFinished
  ) {
    return true;
  }

  return false;
}

exports.checkBooleanType = checkBooleanType;
exports.checkNumberType = checkNumberType;
exports.checkStringType = checkStringType;
