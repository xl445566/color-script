function validateLine(text, isComment) {
  let isCommenting = isComment;
  if (
    text.trim().replace("use strict", "").replace(";", "").length === 2 &&
    text.includes("use strict")
  ) {
    return {
      isSkip: true,
      isCommenting,
    };
  }

  if (!text.trim()) {
    return {
      isSkip: true,
      isCommenting,
    };
  }

  if (text.trim().indexOf("//") === 0) {
    return {
      isSkip: true,
      isCommenting,
    };
  }

  if (
    text.trim().indexOf("/*") === 0 &&
    text.trim().indexOf("*/") === text.trim().length - 2
  ) {
    return {
      isSkip: true,
      isCommenting,
    };
  }

  if (text.trim().indexOf("/*") === 0 && !text.includes("*/")) {
    isCommenting = true;
    return {
      isSkip: true,
      isCommenting: true,
    };
  }

  if (
    !text.includes("/*") &&
    text.includes("*/") &&
    !text.split("*/")[1].trim()
  ) {
    isCommenting = false;
    return {
      isSkip: true,
      isCommenting: false,
    };
  }

  if (
    !text.includes("/*") &&
    text.includes("*/") &&
    text.split("*/")[1].trim()
  ) {
    isCommenting = false;
  }

  return {
    isSkip: false,
    isCommenting,
  };
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

  return {
    line: splitedTextArray.join(" "),
    count,
  };
}

function removeComment(text, currentOffset) {
  const isSlashComment = text.split(";")[1];
  let count = currentOffset;

  if (isSlashComment) {
    return {
      line: text.split(";")[0] + ";",
      count,
    };
  }

  const isBlockComment = text.includes("*/");

  if (isBlockComment) {
    count += text.indexOf(text.split("*/")[1].trimStart());
    return {
      line: text.split("*/")[1].trimStart(),
      count,
    };
  }

  return {
    line: text,
    count,
  };
}

exports.validateLine = validateLine;
exports.trimBlankText = trimBlankText;
exports.removeComment = removeComment;
