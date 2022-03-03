const vscode = require("vscode");
const { tokenTypes, tokenModifiers } = require("./legend");
const {
  checkBooleanType,
  checkNumberType,
  checkStringType,
} = require("./type");
const { validateLine, trimBlankText, removeComment } = require("./cleanUp");

let documents = {};
let pendingDocuments = {};
const helper = Helper();
const provider = Provider();

function Provider() {
  let isCommenting = false;
  let isContinue = false;
  let currentOffset = 0;
  let tokenData = null;
  let tempraryParsedText = {};

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

        const processedPendingDocumentsResults = helper.processPendingDocuments(
          i,
          lines.length,
          pendingDocuments,
          documents
        );

        if (processedPendingDocumentsResults.length) {
          results.push(...processedPendingDocumentsResults);
        }

        continue;
      } else if (isContinue && !lines[i]) {
        const processedPendingDocumentsResults = helper.processPendingDocuments(
          i,
          lines.length,
          pendingDocuments,
          documents
        );

        if (processedPendingDocumentsResults.length) {
          results.push(...processedPendingDocumentsResults);
        }

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
        const processedPendingDocumentsResults = helper.processPendingDocuments(
          i,
          lines.length,
          pendingDocuments,
          documents
        );

        if (processedPendingDocumentsResults.length) {
          results.push(...processedPendingDocumentsResults);
        }

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

      // Number Multiline , String Multiline
      if (definitionArea.slice(-1) !== ";") {
        console.log("멀티라인", definitionArea);

        tempraryParsedText.line = i;
        tempraryParsedText.startCharacter = startPos;
        tempraryParsedText.length = endPos - startPos;
        tempraryParsedText.value = definitionArea;

        isContinue = true;

        const processedPendingDocumentsResults = helper.processPendingDocuments(
          i,
          lines.length,
          pendingDocuments,
          documents
        );

        if (processedPendingDocumentsResults.length) {
          results.push(...processedPendingDocumentsResults);
        }

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
      } else if (
        documents[declarationArea[0]] &&
        documents[declarationArea[0]][0].statement !== "const" &&
        tokenData
      ) {
        // else if :  이미 선언된 변수 , const인 변수는 로직을 수행하지 못하도록 startPos 조정
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
        const variableInValue = definitionArea.slice(0, -1);
        const variableName = declarationArea[0];
        let latestVariableInfo = null;
        startPos = endPos - variableName.length - 1;

        if (documents[variableInValue]) {
          // 선언 O 변수
          latestVariableInfo = documents[variableInValue].slice(-1)[0];
          tokenData = latestVariableInfo.tokenData;

          documents[variableName].push({
            value: definitionArea,
            line: i,
            startPos,
            endPos,
            length: endPos - startPos,
            tokenData,
          });
        } else {
          if (!pendingDocuments[variableName]) {
            // 선언 X 변수 처음 발견시
            pendingDocuments[variableName] = [
              {
                value: variableInValue,
                line: i,
                startPos,
                endPos,
                length: endPos - startPos,
                tokenData: null,
              },
            ];
          } else {
            // 선언 X 변수 중복 발견시
            pendingDocuments[variableName].push({
              value: variableInValue,
              line: i,
              startPos,
              endPos,
              length: endPos - startPos,
              tokenData: null,
            });
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

      const processedPendingDocumentsResults = helper.processPendingDocuments(
        i,
        lines.length,
        pendingDocuments,
        documents
      );

      if (processedPendingDocumentsResults.length) {
        results.push(...processedPendingDocumentsResults);
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

function Helper() {
  function validateType(value) {
    let tokenData = null;

    if (checkBooleanType(value)) {
      tokenData = provider.parseToken("boolean");
    } else if (checkNumberType(value)) {
      tokenData = provider.parseToken("number");
    } else if (checkStringType(value)) {
      tokenData = provider.parseToken("string");
    }

    return tokenData;
  }

  function processPendingDocuments(
    currentLine,
    lastLine,
    pendingDocuments,
    documents
  ) {
    const keys = Object.keys(pendingDocuments);
    const results = [];

    if (currentLine === lastLine - 1) {
      keys.forEach((key) => {
        const statement = documents[key][0].statement;
        const pendingDocumentArray = pendingDocuments[key];

        pendingDocumentArray.forEach((pendingDocument) => {
          if (statement === "var") {
            const tokenData = provider.parseToken("undefined");

            results.push({
              line: pendingDocument.line,
              startCharacter: pendingDocument.startPos,
              length: pendingDocument.length,
              tokenType: tokenData.tokenType,
              tokenModifiers: tokenData.tokenModifiers,
            });
          } else if (statement === "let") {
            const tokenData = provider.parseToken("not_defined");

            results.push({
              line: pendingDocument.line,
              startCharacter: pendingDocument.startPos,
              length: pendingDocument.length,
              tokenType: tokenData.tokenType,
              tokenModifiers: tokenData.tokenModifiers,
            });
          }
        });
      });
    }

    return results;
  }

  return {
    validateType,
    processPendingDocuments,
  };
}

module.exports = provider;
