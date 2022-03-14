const constants = require("./constants");

function cleanLine(text, isComment) {
  let isCommenting = isComment;

  if (
    text
      .trim()
      .replace(constants.USE_STRICT, constants.NONE)
      .replace(constants.SEMI_COLON, constants.NONE).length === 2 &&
    text.includes(constants.USE_STRICT)
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

  if (text.trim().indexOf(constants.LINE_COMMENT_DOUBLE_SLASH) === 0) {
    return {
      isSkip: true,
      isCommenting,
    };
  }

  if (
    text.trim().indexOf(constants.BLOCK_COMMENT_START) === 0 &&
    text.trim().indexOf(constants.BLOCK_COMMENT_END) === text.trim().length - 2
  ) {
    return {
      isSkip: true,
      isCommenting,
    };
  }

  if (
    text.trim().indexOf(constants.BLOCK_COMMENT_START) === 0 &&
    !text.includes(constants.BLOCK_COMMENT_END)
  ) {
    isCommenting = true;
    return {
      isSkip: true,
      isCommenting: true,
    };
  }

  if (
    !text.includes(constants.BLOCK_COMMENT_START) &&
    text.includes(constants.BLOCK_COMMENT_END) &&
    !text.split(constants.BLOCK_COMMENT_END)[1].trim()
  ) {
    isCommenting = false;
    return {
      isSkip: true,
      isCommenting: false,
    };
  }

  if (
    !text.includes(constants.BLOCK_COMMENT_START) &&
    text.includes(constants.BLOCK_COMMENT_END) &&
    text.split(constants.BLOCK_COMMENT_END)[1].trim()
  ) {
    isCommenting = false;
  }

  return {
    isSkip: false,
    isCommenting,
  };
}

function cleanBlank(text) {
  let isBlank = true;
  let count = 0;
  const splitedTextArray = text.split(constants.BLANK);

  while (isBlank) {
    const char = splitedTextArray[0];

    isBlank = char === constants.NONE ? true : false;

    if (isBlank) {
      splitedTextArray.shift();
      count += 1;
    }
  }

  return {
    line: splitedTextArray.join(constants.BLANK).trim(),
    count,
  };
}

function cleanComment(text, currentOffset) {
  const isSlashComment = text.split(constants.SEMI_COLON)[1];
  let count = currentOffset;

  if (isSlashComment) {
    return {
      line: text.split(constants.SEMI_COLON)[0] + constants.SEMI_COLON,
      count,
    };
  }

  const isBlockComment = text.includes(constants.BLOCK_COMMENT_END);

  if (isBlockComment) {
    count += text.indexOf(
      text.split(constants.BLOCK_COMMENT_END)[1].trimStart()
    );
    return {
      line: text.split(constants.BLOCK_COMMENT_END)[1].trimStart(),
      count,
    };
  }

  return {
    line: text,
    count,
  };
}

exports.cleanLine = cleanLine;
exports.cleanBlank = cleanBlank;
exports.cleanComment = cleanComment;
