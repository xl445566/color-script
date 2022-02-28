const vscode = require("vscode");
const { tokenTypes, tokenModifiers } = require("./legend");
const { checkBooleanType, checkNumberType } = require("./type");
const { validateLine, trimBlankText, removeComment } = require("./cleanUp");

function createProvider() {
  let isCommenting = false;
  let isContinue = false;
  let currentOffset = 0;
  let tokenData = null;
  let parsedText = {};

  async function provideDocumentSemanticTokens() {
    const allTokens = parseText(
      vscode.window.activeTextEditor.document.getText()
    );
    const builder = new vscode.SemanticTokensBuilder();

    allTokens.forEach((token) => {
      builder.push(
        token.line,
        token.startCharacter,
        token.length,
        encodeTokenType(token.tokenType),
        encodeTokenModifiers(token.tokenModifiers)
      );
    });

    return builder.build();
  }

  function encodeTokenType(tokenType) {
    if (tokenTypes.has(tokenType)) {
      return tokenTypes.get(tokenType);
    } else if (tokenType === "notInLegend") {
      return tokenTypes.size + 2;
    }

    return 0;
  }

  function encodeTokenModifiers(strTokenModifiers) {
    let result = 0;

    for (let i = 0; i < strTokenModifiers.length; i++) {
      const tokenModifier = strTokenModifiers[i];

      if (tokenModifiers.has(tokenModifier)) {
        result = result | (1 << tokenModifiers.get(tokenModifier));
      } else if (tokenModifier === "notInLegend") {
        result = result | (1 << (tokenModifiers.size + 2));
      }
    }

    return result;
  }

  function parseText(text) {
    const results = [];
    const lines = text.split(/\r\n|\r|\n/);

    for (let i = 0; i < lines.length; i++) {
      if (isContinue && lines[i]) {
        parsedText.value += lines[i];

        if (lines[i].includes(";")) {
          const validatedTypeResult = validateType(parsedText.value);

          if (validatedTypeResult) {
            results.push({
              line: parsedText.line,
              startCharacter: parsedText.startCharacter,
              length: parsedText.length,
              tokenType: tokenData.tokenType,
              tokenModifiers: tokenData.tokenModifiers,
            });
          }

          parsedText = {};
          isContinue = false;
        }

        continue;
      } else if (isContinue && !lines[i]) {
        continue;
      }

      tokenData = null;
      currentOffset = 0;
      const validatedLineResults = validateLine(lines[i], isCommenting);
      const isSkip = validatedLineResults[0];
      isCommenting = validatedLineResults[1];

      if (isSkip || isCommenting) {
        continue;
      }

      const trimedLineResults = trimBlankText(lines[i]);
      const line = trimedLineResults[0];
      currentOffset = trimedLineResults[1];

      const removedCommentLineResults = removeComment(line, currentOffset);
      const convertedLine = removedCommentLineResults[0].split("=");
      currentOffset = removedCommentLineResults[1];

      const declarationArea = convertedLine[0].split(" ");
      const definitionArea = convertedLine[1].trim();

      const startPos = currentOffset + declarationArea[0].length + 1;
      const endPos = startPos + declarationArea[1].length;

      const validatedTypeResult = validateType(definitionArea);

      // console.log("convertedLine :::::", convertedLine);
      // console.log("variable :::::", declarationArea);
      // console.log("offset :::::", currentOffset);
      // console.log(isNaN(definitionArea.slice(0, -1)));
      // console.log("\n");
      // console.log("line :::::", line);
      // console.log("value :::::", definitionArea);

      if (!definitionArea.includes(";")) {
        parsedText.line = i;
        parsedText.startCharacter = startPos;
        parsedText.length = endPos - startPos;
        parsedText.value = definitionArea;

        isContinue = true;
        continue;
      }

      if (validatedTypeResult) {
        results.push({
          line: i,
          startCharacter: startPos,
          length: endPos - startPos,
          tokenType: tokenData.tokenType,
          tokenModifiers: tokenData.tokenModifiers,
        });
      }
    }

    return results;
  }

  function parseToken(type) {
    return {
      tokenType: "type",
      tokenModifiers: ["declaration", `${type}`],
    };
  }

  function validateType(value) {
    if (checkBooleanType(value)) {
      tokenData = parseToken("boolean");
    } else if (checkNumberType(value)) {
      tokenData = parseToken("number");
    }

    return tokenData;
  }

  return {
    provideDocumentSemanticTokens,
  };
}

const provider = createProvider();

module.exports = provider;
