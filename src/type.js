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

  const symbols = ["+", "-", "/", "*", "%", " ", "(", ")"];
  const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  let text = value;

  symbols.forEach((symbol) => {
    text = text.replaceAll(symbol, "");
  });

  numbers.forEach((number) => {
    text = text.replaceAll(number, "");
  });

  return text === ";";
}

exports.checkBooleanType = checkBooleanType;
exports.checkNumberType = checkNumberType;
