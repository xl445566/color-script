const vscode = require("vscode");
const { tokenTypes, tokenModifiers } = require("./legend");
const {
  checkBooleanType,
  checkNumberType,
  checkStringType,
  checkNullType,
  checkUndefinedType,
} = require("./type");
const { validateLine, trimBlankText, removeComment } = require("./cleanUp");

const provider = makeProvider();
const helper = makeProvdierHelpers();

function makeProvider() {
  let documents = {};
  let pendingDocuments = {};
  let tempraryParsedText = {};
  let isCommenting = false;
  let isContinue = false;

  let tokenData = null;
  let currentOffset = 0;

  async function provideDocumentSemanticTokens() {
    // throttle 예정
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
    }

    return 0;
  }

  function encodeTokenModifiers(strTokenModifiers) {
    let result = 0;

    for (let i = 0; i < strTokenModifiers.length; i++) {
      const tokenModifier = strTokenModifiers[i];

      if (tokenModifiers.has(tokenModifier)) {
        result = result | (1 << tokenModifiers.get(tokenModifier));
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
      if (i === 0) {
        documents = {};
        pendingDocuments = {};
        tempraryParsedText = {};
        isContinue = false;
        isCommenting = false;
      }

      // Multiline 처리
      if (isContinue && lines[i]) {
        tempraryParsedText.value += lines[i];

        if (lines[i].slice(-1) === ";") {
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
        // isContinue = false;
        continue;
      }

      // tokenData, currentOffset 초기화
      tokenData = null;
      currentOffset = 0;

      // 공백처리 , 주석처리 , 빈줄처리
      const validatedLineResults = validateLine(lines[i], isCommenting);
      const isSkip = validatedLineResults.isSkip;
      isCommenting = validatedLineResults.isCommenting;

      if (isSkip || isCommenting) {
        continue;
      }

      const trimedLineResults = trimBlankText(lines[i]);
      let trimedLine = trimedLineResults.line;
      currentOffset = trimedLineResults.count;

      // undefined 처리
      if (trimedLine.trim().split(" ").length === 2) {
        trimedLine = helper.refactorUndefinedType(trimedLine.trim());

        if (!trimedLine) {
          continue;
        }
      }

      const removedCommentLineResults = removeComment(
        trimedLine,
        currentOffset
      );
      const convertedLineArray = removedCommentLineResults.line.split("=");
      currentOffset = removedCommentLineResults.count;

      // 변수 , 값 분류
      const declarationArea = convertedLineArray[0].split(" ");
      let definitionArea = convertedLineArray[1].trim();

      // 변수의 값으로 Type 체크 tokenData 생성
      tokenData = helper.validateType(definitionArea);

      // 변수 시작 , 종료 위치
      let startPos = currentOffset + declarationArea[0].length + 1;
      const endPos = startPos + declarationArea[1].length;

      // Number Multiline , String Multiline
      if (definitionArea.slice(-1) !== ";") {
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
        const variableInValue = definitionArea.slice(0, -1);

        if (tokenData) {
          // case : 첫 변수선언 = 값
          documents[variableName] = [
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
        } else {
          // case : 첫 변수선언 = 변수
          if (documents[variableInValue]) {
            // 변수 (선언 O)
            const latestVariableInfo = documents[variableInValue].slice(-1)[0];
            tokenData = latestVariableInfo.tokenData;

            documents[variableName] = [
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
          } else {
            if (!pendingDocuments[variableInValue]) {
              // 변수 (선언 X)
              pendingDocuments[variableInValue] = [
                {
                  statement,
                  variable: variableName,
                  line: i,
                  startPos,
                  endPos,
                  length: endPos - startPos,
                  tokenData: null,
                },
              ];
            } else {
              // 선언 X 변수 중복 발견시
              pendingDocuments[variableInValue].push({
                variable: variableName,
                line: i,
                startPos,
                endPos,
                length: endPos - startPos,
                tokenData: null,
              });
            }
          }
        }

        if (pendingDocuments[variableName] && statement === "var") {
          while (pendingDocuments[variableName].length) {
            const pendingDocument = pendingDocuments[variableName].shift();
            const tempTokenData = parseToken("undefined");

            results.push({
              line: pendingDocument.line,
              startCharacter: pendingDocument.startPos,
              length: pendingDocument.length,
              tokenType: tempTokenData.tokenType,
              tokenModifiers: tempTokenData.tokenModifiers,
            });

            if (!documents[pendingDocument.variable]) {
              documents[pendingDocument.variable] = [
                {
                  statement: pendingDocument.statement,
                  value: variableName,
                  line: pendingDocument.line,
                  startPos: pendingDocument.startPos,
                  endPos: pendingDocument.endPos,
                  length: pendingDocument.endPos - pendingDocument.startPos,
                  tokenData: tempTokenData,
                },
              ];
            } else {
              documents[pendingDocument.variable].push({
                statement: pendingDocument.statement,
                value: variableName,
                line: pendingDocument.line,
                startPos: pendingDocument.startPos,
                endPos: pendingDocument.endPos,
                length: pendingDocument.endPos - pendingDocument.startPos,
                tokenData: tempTokenData,
              });
            }
          }
        }
      } else if (
        documents[declarationArea[0]] &&
        documents[declarationArea[0]][0].statement !== "const" &&
        tokenData
      ) {
        // else if :  let이나 var로 선언한 변수 = "asdf"; 이렇게 하드코딩 할당 시
        // const인 변수는 로직을 수행하지 못하도록 startPos 조정
        const variableName = declarationArea[0];
        startPos = endPos - variableName.length - 1;

        documents[variableName].push({
          value: definitionArea,
          line: i,
          startPos,
          endPos,
          length: endPos - startPos,
          tokenData,
        });
      } else if (documents[declarationArea.slice(0, -1)] && !tokenData) {
        // else if : 변수 = 변수를 할당할 때
        const variableName = declarationArea[0];
        const variableInValue = definitionArea.slice(0, -1);
        const statement = documents[declarationArea.slice(0, -1)][0].statement;
        let latestVariableInfo = null;
        startPos = endPos - variableName.length - 1;

        if (documents[variableInValue]) {
          // 선언 O 변수
          latestVariableInfo = documents[variableInValue].slice(-1)[0];
          tokenData = latestVariableInfo.tokenData;

          documents[variableName].push({
            value: variableInValue,
            line: i,
            startPos,
            endPos,
            length: endPos - startPos,
            tokenData,
          });
        } else {
          if (!pendingDocuments[variableInValue]) {
            // 변수 (선언 X)
            pendingDocuments[variableInValue] = [
              {
                variable: variableName,
                line: i,
                startPos,
                endPos,
                length: endPos - startPos,
                tokenData: null,
              },
            ];
          } else {
            // 선언 X 변수 중복 발견시
            pendingDocuments[variableInValue].push({
              variable: variableName,
              line: i,
              startPos,
              endPos,
              length: endPos - startPos,
              tokenData: null,
            });
          }
        }

        if (pendingDocuments[variableName] && statement !== "const") {
          while (pendingDocuments[variableName].length) {
            const pendingDocument = pendingDocuments[variableName].shift();
            const tempTokenData = parseToken("undefined");

            results.push({
              line: pendingDocument.line,
              startCharacter: pendingDocument.startPos,
              length: pendingDocument.length,
              tokenType: tempTokenData.tokenType,
              tokenModifiers: tempTokenData.tokenModifiers,
            });

            if (!documents[pendingDocument.variable]) {
              documents[pendingDocument.variable] = [
                {
                  statement: pendingDocument.statement,
                  value: variableName,
                  line: pendingDocument.line,
                  startPos: pendingDocument.startPos,
                  endPos: pendingDocument.endPos,
                  length: pendingDocument.endPos - pendingDocument.startPos,
                  tokenData: tempTokenData,
                },
              ];
            } else {
              documents[pendingDocument.variable].push({
                statement: pendingDocument.statement,
                value: variableName,
                line: pendingDocument.line,
                startPos: pendingDocument.startPos,
                endPos: pendingDocument.endPos,
                length: pendingDocument.endPos - pendingDocument.startPos,
                tokenData: tempTokenData,
              });
            }
          }
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

function makeProvdierHelpers() {
  function validateType(value) {
    let tokenData = null;
    const checkFunctions = [
      checkBooleanType,
      checkNumberType,
      checkStringType,
      checkNullType,
      checkUndefinedType,
    ];
    const types = ["boolean", "number", "string", "null", "undefined"];

    for (let i = 0; i < checkFunctions.length; i++) {
      if (checkFunctions[i](value)) {
        tokenData = provider.parseToken(types[i]);
        return tokenData;
      }
    }

    return tokenData;
  }

  function refactorUndefinedType(value) {
    const hasSemicolon = value.slice(-1) === ";";
    let splitedValue = value.split(" ");

    if (
      hasSemicolon &&
      (splitedValue[0] === "var" || splitedValue[0] === "let")
    ) {
      splitedValue[1] = splitedValue[1].slice(0, -1);
      splitedValue[2] = "=";
      splitedValue[3] = "undefined;";

      return splitedValue.join(" ");
    }

    return "";
  }

  return {
    validateType,
    refactorUndefinedType,
  };
}

module.exports = provider;
