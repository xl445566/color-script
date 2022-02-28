function validateLine(text, isCommenting) {
  if (!text) {
    return [true, isCommenting];
  }

  if (text.trim().indexOf("//") === 0) {
    return [true, isCommenting];
  }

  if (
    text.trim().indexOf("/*") === 0 &&
    text.trim().indexOf("*/") === text.trim().length - 2
  ) {
    return [true, isCommenting];
  }

  if (text.trim().indexOf("/*") === 0 && !text.includes("*/")) {
    isCommenting = true;
    return [true, isCommenting];
  }

  if (
    !text.includes("/*") &&
    text.includes("*/") &&
    !text.split("*/")[1].trim()
  ) {
    isCommenting = false;
    return [true, isCommenting];
  }

  if (
    !text.includes("/*") &&
    text.includes("*/") &&
    text.split("*/")[1].trim()
  ) {
    isCommenting = false;
  }

  return [false, isCommenting];
}

function trimBlankText(text) {
  let isBlank = true;
  let count = 0;
  const splitedTextArray = text.split(" ");

  while (isBlank) {
    const char = splitedTextArray[0];

    isBlank = char === "" ? true : false;

    if (isBlank) {
      splitedTextArray.shift();
      count += 1;
    }
  }

  return [splitedTextArray.join(" "), count];
}

function removeComment(text, currentOffset) {
  const isSlashComment = text.split(";")[1];
  let count = currentOffset;

  if (isSlashComment) {
    return [text.split(";")[0] + ";", count];
  }

  const isBlockComment = text.includes("*/");

  if (isBlockComment) {
    count += text.indexOf(text.split("*/")[1].trimStart());
    return [text.split("*/")[1].trimStart(), count];
  }

  return [text, count];
}

exports.validateLine = validateLine;
exports.trimBlankText = trimBlankText;
exports.removeComment = removeComment;
