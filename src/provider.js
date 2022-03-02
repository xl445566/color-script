const vscode = require("vscode");
const { tokenTypes, tokenModifiers } = require("./legend");
const { checkBooleanType, checkNumberType } = require("./type");
const { validateLine, trimBlankText, removeComment } = require("./cleanUp");

const document = {};
const helper = helpProvider();
const provider = createProvider();

function createProvider() {
  let isCommenting = false;
  let isContinue = false;
  let currentOffset = 0;
  let tokenData = null;
  let tempParsedText = {};

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

  function validateType(value) {
    if (checkBooleanType(value)) {
      tokenData = parseToken("boolean");
    } else if (checkNumberType(value)) {
      tokenData = parseToken("number");
    }

    return tokenData;
  }

  function parseToken(type) {
    return {
      tokenType: "type",
      tokenModifiers: ["declaration", `${type}`],
    };
  }

  function parseText(text) {
    const results = [];
    const lines = text.split(/\r\n|\r|\n/);

    for (let i = 0; i < lines.length; i++) {
      // Multiline 처리
      if (isContinue && lines[i]) {
        tempParsedText.value += lines[i];

        if (lines[i].includes(";")) {
          const validatedTypeResult = validateType(tempParsedText.value);

          if (validatedTypeResult) {
            results.push({
              line: tempParsedText.line,
              startCharacter: tempParsedText.startCharacter,
              length: tempParsedText.length,
              tokenType: tokenData.tokenType,
              tokenModifiers: tokenData.tokenModifiers,
            });
          }

          tempParsedText = {};
          isContinue = false;
        }

        continue;
      } else if (isContinue && !lines[i]) {
        continue;
      }

      tokenData = null;
      currentOffset = 0;

      // 공백체크 , 빈줄체크 , 주석처리
      const validatedLineResults = validateLine(lines[i], isCommenting);
      const isSkip = validatedLineResults.isSkip;
      isCommenting = validatedLineResults.isCommenting;

      if (isSkip || isCommenting) {
        continue;
      }

      const trimedLineResults = trimBlankText(lines[i]);
      const trimedLine = trimedLineResults.line;
      currentOffset = trimedLineResults.count;

      const removedCommentLineResults = removeComment(
        trimedLine,
        currentOffset
      );
      const convertedLineArray = removedCommentLineResults.line.split("=");
      currentOffset = removedCommentLineResults.count;

      // 변수 , 값 분류
      const declarationArea = convertedLineArray[0].split(" ");
      const definitionArea = convertedLineArray[1].trim();

      // 변수 시작 , 종료 포지션
      let startPos = currentOffset + declarationArea[0].length + 1;
      const endPos = startPos + declarationArea[1].length;

      // 변수의 값으로 Type 체크 tokenData 생성
      validateType(definitionArea);

      // Number Multiline 경우
      if (!definitionArea.includes(";")) {
        tempParsedText.line = i;
        tempParsedText.startCharacter = startPos;
        tempParsedText.length = endPos - startPos;
        tempParsedText.value = definitionArea;

        isContinue = true;

        continue;
      }

      // if : 변수 초기선언시 const , var , let -> parsing
      // else if :  이미 선언된 변수 , const인 변수는 로직을 수행하지 못하도록 startPos 조정
      // else if : 변수 = 변수를 할당할 때
      if (
        declarationArea[0] === "var" ||
        declarationArea[0] === "let" ||
        declarationArea[0] === "const"
      ) {
        const variableName = declarationArea[1];
        const statement = declarationArea[0];

        document[variableName] = [
          {
            statement,
            value: definitionArea,
            line: i,
            startPos,
            endPos,
            length: endPos - startPos,
            tokenData,
          },
        ];
      } else if (
        document[declarationArea[0]] &&
        document[declarationArea[0]][0].statement !== "const" &&
        tokenData
      ) {
        const variableName = declarationArea[0];
        startPos = endPos - variableName.length - 1;

        document[variableName].push({
          value: definitionArea,
          line: i,
          startPos,
          endPos,
          length: endPos - startPos,
          tokenData,
        });
      } else if (document[declarationArea.slice(0, -1)] && !tokenData) {
        const variableName = declarationArea[0];
        const latestVariableInfo =
          document[variableName][document[variableName].length - 1];

        startPos = endPos - variableName.length - 1;
        tokenData = latestVariableInfo.tokenData;

        document[variableName].push({
          value: definitionArea,
          line: i,
          startPos,
          endPos,
          length: endPos - startPos,
          tokenData,
        });
      }

      if (tokenData) {
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

  return {
    provideDocumentSemanticTokens,
  };
}

function helpProvider() {
  return {};
}

module.exports = provider;

// console.log("\n");
// console.log("variable :::::", declarationArea);
// console.log("value :::::", definitionArea);
// console.log("line :::::", i);
// console.log("offset :::::", currentOffset);
// console.log("start :::::", startPos - declarationArea[0].length);
// console.log("end :::::", endPos);
// console.log("validatedTypeResult :::::", validatedTypeResult);
// console.log("latestVariableInfo", latestVariableInfo);
// console.log(document[declarationArea.slice(0, -1)]);
