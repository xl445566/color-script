const vscode = require("vscode");
const { tokenTypes, tokenModifiers } = require("./legend");
const { checkBooleanType, checkNumberType } = require("./type");
const { validateLine, trimBlankText, removeComment } = require("./cleanUp");

let document = {};
const helper = createHelper();
const provider = createProvider();

function createProvider() {
  let isCommenting = false;
  let isContinue = false;
  let currentOffset = 0;
  let tokenData = null;
  let tempraryParsedText = {};
  let pendingDocument = {};

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
        tempraryParsedText.value += lines[i];

        if (lines[i].includes(";")) {
          tokenData = helper.validateType(tempraryParsedText.value);

          if (tokenData) {
            results.push({
              line: tempraryParsedText.line,
              startCharacter: tempraryParsedText.startCharacter,
              length: tempraryParsedText.length,
              tokenType: tokenData.tokenType,
              tokenModifiers: tokenData.tokenModifiers,
            });
          }

          tempraryParsedText = {};
          isContinue = false;
        }

        continue;
      } else if (isContinue && !lines[i]) {
        continue;
      }

      // tokenData, currentOffset 초기화
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

      // 변수 시작 , 종료 위치
      let startPos = currentOffset + declarationArea[0].length + 1;
      const endPos = startPos + declarationArea[1].length;

      // 변수의 값으로 Type 체크 tokenData 생성
      tokenData = helper.validateType(definitionArea);

      // Number Multiline 경우
      if (!definitionArea.includes(";")) {
        tempraryParsedText.line = i;
        tempraryParsedText.startCharacter = startPos;
        tempraryParsedText.length = endPos - startPos;
        tempraryParsedText.value = definitionArea;

        isContinue = true;

        continue;
      }

      // if : 변수 초기선언시 const , var , let -> parsing
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
        // else if :  이미 선언된 변수 , const인 변수는 로직을 수행하지 못하도록 startPos 조정
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
        // else if : 변수 = 변수를 할당할 때
        const variableInValue = definitionArea.slice(0, -1);
        const variableName = declarationArea[0];
        let latestVariableInfo = null;

        if (document[variableInValue]) {
          // 선언 O 변수
          latestVariableInfo = document[variableInValue].slice(-1)[0];
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
          console.log("\n");
          console.log("variable :::::", declarationArea);
          console.log("value :::::", definitionArea);
          console.log("line :::::", i);
          console.log("offset :::::", currentOffset);
          console.log("start :::::", startPos - declarationArea[0].length);
          console.log("end :::::", endPos);
          console.log("tokenData :::::", tokenData);
        } else {
          // 선언 X 변수
          console.log("\n");
          console.log("선언하지 않은 변수를 할당받은 경우");
          console.log("변수 : ", variableName);
          console.log("값 : ", definitionArea);

          // if (pendingDocument[de]
        }
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
    encodeTokenModifiers,
    encodeTokenType,
    parseText,
    parseToken,
  };
}

function createHelper() {
  function validateType(value) {
    let tokenData = null;

    if (checkBooleanType(value)) {
      tokenData = provider.parseToken("boolean");
    } else if (checkNumberType(value)) {
      tokenData = provider.parseToken("number");
    }

    return tokenData;
  }

  return {
    validateType,
  };
}

module.exports = provider;
