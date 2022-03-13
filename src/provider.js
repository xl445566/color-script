"use strict";

const vscode = require("vscode");
const fs = require("fs");
const { tokenTypes, tokenModifiers } = require("./legend");
const {
  checkBooleanType,
  checkNumberType,
  checkStringType,
  checkNullType,
  checkUndefinedType,
  checkArrayType,
  checkObjectType,
} = require("./type");
const { cleanLine, cleanBlank, cleanComment } = require("./cleanUp");
const { cloneDeep } = require("./utils");

const provider = makeProvider();
const helper = makeProvdierHelpers();

function makeProvider() {
  async function provideDocumentSemanticTokens() {
    const allTokens = parseText(
      vscode.window.activeTextEditor.document.getText(),
      0
    ).tokens;

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

  function parseText(text, start, docs, pendingDocs) {
    const path = vscode.window.activeTextEditor.document.uri.fsPath;

    const lines = text.split(/\r\n|\r|\n/);

    const results = [];
    let documents = docs === undefined ? {} : docs;
    let pendingDocuments = pendingDocs === undefined ? {} : pendingDocs;
    let scopeDocuments = {};
    let tempraryParsedText = {};

    let tokenData = null;
    let currentOffset = 0;

    let isCommenting = false;
    let isContinue = false;

    let isStartScope = false;
    let isScope = false;
    let isFinishScope = false;

    let isStartFunctionScope = false;
    let isFunctionScope = false;
    let isFinishFunctionScope = false;

    let isExport = false;
    let isStartImport = false;
    let isFinishImport = false;
    let importText = "";

    let scopeLineNumber = 0;
    let scopeText = "";

    for (let i = 0; i < lines.length; i++) {
      try {
        const line = lines[i];

        // import
        if (
          (line.startsWith("import") && line.endsWith(`js";`)) ||
          isFinishImport
        ) {
          const code = importText === "" ? line : importText;

          const filteredLineArry = code
            .slice(0, -1)
            .replace("import", "")
            .replace("from", "")
            .replace("{", "")
            .replace("}", "")
            .replaceAll(",", "")
            .split(" ")
            .filter((item) => item !== "");

          const importPath = filteredLineArry
            .slice(-1)[0]
            .replaceAll(".", "")
            .split("js")
            .join(".js")
            .slice(1, -1);

          const slashCount =
            importPath.split("/").length - (importPath.split("/").length - 1);

          const importCode = fs.readFileSync(
            path.split("/").slice(0, -slashCount).join("/") + importPath,
            "utf8"
          );

          const parsedImportDocuments = parseText(importCode, 0).dom;

          const exportVariableNames = importCode
            .split(/\r\n|\r|\n/)
            .filter((line) => {
              return (
                (line.includes("export") && line.includes("=")) ||
                line.includes("export default")
              );
            })
            .map((line) => {
              return line.split(" ")[2];
            });

          const startIndex = code.indexOf("{");
          const endIndex = code.indexOf("}");

          const isExistBracket = startIndex !== -1 ? true : false;
          let importVariableName = "";
          let exportVariableName = "";

          if (!isExistBracket) {
            importVariableName = line
              .trim()
              .split(" ")
              .map((item, index, array) => {
                if (item === "import") {
                  return array[index + 1];
                }
              })
              .filter((item) => item !== undefined);

            importVariableName =
              importVariableName.length === 1 ? importVariableName[0] : "";
          } else {
            importVariableName = code
              .substring(0, startIndex)
              .trim()
              .replace(",", "")
              .split(" ")
              .map((item, index, array) => {
                if (item === "import") {
                  return array[index + 1];
                }
              })
              .filter((item) => item !== undefined);

            importVariableName =
              importVariableName.length === 1 ? importVariableName[0] : "";
          }

          const importVariableNames = code
            .substring(startIndex, endIndex + 1)
            .slice(1, -1)
            .split(",")
            .map((variableName) => {
              const name = variableName.trim();
              if (exportVariableNames.includes(name)) {
                return name;
              }
            })
            .filter((variableName) => variableName !== undefined);

          if (importVariableName) {
            let copyExportVariableNames = exportVariableNames.slice();
            const copyImportVariableNames = importVariableNames.slice();

            copyExportVariableNames.forEach((name) => {
              const index = copyImportVariableNames.indexOf(name);

              if (index === -1) {
                exportVariableName = name.slice(0, -1);

                documents[importVariableName] =
                  parsedImportDocuments[exportVariableName];
              }
            });
          }

          importVariableNames.forEach((name) => {
            documents[name] = parsedImportDocuments[name];
          });

          // console.log("\n");
          // console.log("importText", code);
          // console.log("isStartImport", isStartImport);
          // console.log("isFinishImport", isFinishImport);
          // console.log("임포트코드 \n", importCode);
          // console.log("프롬 주소", importPath.split("/"));
          // console.log("임포트 변수명 리스트", importVariableNames);
          // console.log("slash 갯수", slashCount);
          // console.log("익스포트변수명들 \n", exportVariableNames);
          // console.log("임포트 파싱", parsedImportDocuments);
          // console.log("도큐먼트", documents);
          // console.log("익스포트 디폴트 변수", importVariableName);

          isFinishImport = false;
          importText = "";
          continue;
        }

        // import multiline
        if (line.startsWith("import") || isStartImport) {
          isStartImport = true;
          importText += " " + line;

          if (line.endsWith(`js";`)) {
            isStartImport = false;
            isFinishImport = true;
          }

          continue;
        }

        // export
        if (line.startsWith("export") && line.includes("=")) {
          isExport = true;
        }

        if (line.startsWith("export default")) {
          continue;
        }

        // Multiline 처리
        if (isContinue && line) {
          tempraryParsedText.value += line;

          if (line.slice(-1) === ";") {
            tokenData = helper.handleLineTypeValidate(tempraryParsedText.value);
            const declarationArea = tempraryParsedText.declarationArea;
            const definitionArea = tempraryParsedText.value;

            if (
              declarationArea[0] === "const" ||
              declarationArea[0] === "let" ||
              declarationArea[0] === "var"
            ) {
              documents[declarationArea[1]] = [
                {
                  statement: declarationArea[0],
                  value: definitionArea,
                  line: tempraryParsedText.line,
                  startPos: tempraryParsedText.startPos,
                  endPos: tempraryParsedText.endPos,
                  length: tempraryParsedText.length,
                  tokenData,
                },
              ];
            } else if (
              documents[declarationArea[0]] &&
              documents[declarationArea[0]][0].statement !== "const" &&
              tokenData
            ) {
              const variableName = declarationArea[0];
              tempraryParsedText.startPos =
                tempraryParsedText.endPos - variableName.length - 1;

              documents[variableName].push({
                value: definitionArea,
                line: tempraryParsedText.line,
                startPos: tempraryParsedText.startPos,
                endPos: tempraryParsedText.endPos,
                length: tempraryParsedText.endPos - tempraryParsedText.startPos,
                tokenData,
              });
            }

            if (tokenData) {
              results.push({
                line: tempraryParsedText.line,
                startCharacter: tempraryParsedText.startPos,
                length: tempraryParsedText.endPos - tempraryParsedText.startPos,
                tokenType: tokenData.tokenType,
                tokenModifiers: tokenData.tokenModifiers,
              });
            }

            tempraryParsedText = {};
            isContinue = false;
          }

          continue;
        }

        // 스코프
        const resultScope = helper.handleScopeCreate(
          line,
          isStartScope,
          isFinishScope,
          isScope,
          isStartFunctionScope,
          isFinishFunctionScope,
          isFunctionScope
        );

        isStartScope = resultScope.isStartScope;
        isFinishScope = resultScope.isFinishScope;
        isScope = resultScope.isScope;

        isStartFunctionScope = resultScope.isStartFunctionScope;
        isFinishFunctionScope = resultScope.isFinishFunctionScope;
        isFunctionScope = resultScope.isFunctionScope;

        if (isStartScope && !isFinishScope && !isScope) {
          isScope = true;
          scopeLineNumber = start + i + 1;
          continue;
        }

        if (isScope && !isFinishScope) {
          if (!isStartScope) {
            scopeLineNumber = start + i;
            isStartScope = true;
          }
          scopeText += line + "\n";
          continue;
        }

        if (isFinishScope) {
          // 스코프 코드 재귀
          const copyScopeDocuments = cloneDeep(scopeDocuments);
          const copyPendingDocuments = cloneDeep(pendingDocuments);
          const parsedTextResults = parseText(
            scopeText,
            scopeLineNumber,
            copyScopeDocuments,
            copyPendingDocuments
          );

          // 초기화
          if (!isStartScope) {
            isScope = true;
          } else {
            isScope = false;
          }
          isStartScope = false;
          isFinishScope = false;
          scopeLineNumber = 0;
          scopeText = "";

          // 스코프 tokens 추가
          results.push(...parsedTextResults.tokens);

          // 스코프 documents 추가
          for (const key in parsedTextResults.dom) {
            if (parsedTextResults.dom[key][0].statement === "var") {
              const document = {
                [key]: parsedTextResults.dom[key],
              };
              documents = Object.assign(documents, document);
            }
          }
          scopeDocuments = Object.assign(scopeDocuments, parsedTextResults.dom);

          // 스코프 pendingDocuments 추가
          pendingDocuments = Object.assign(
            pendingDocuments,
            parsedTextResults.pendingDom
          );

          continue;
        }

        if (
          isStartFunctionScope &&
          !isFinishFunctionScope &&
          !isFunctionScope
        ) {
          isFunctionScope = true;
          scopeLineNumber = start + i + 1;
          continue;
        }

        if (isFunctionScope && !isFinishFunctionScope) {
          if (!isFunctionScope) {
            scopeLineNumber = start + i;
            isFunctionScope = true;
          }
          scopeText += line + "\n";
          continue;
        }

        if (isFinishFunctionScope) {
          // 함수 스코프 코드 재귀
          const copyDocument = cloneDeep(documents);
          const copyPendingDocuments = cloneDeep(pendingDocuments);
          const parsedTextResults = parseText(
            scopeText,
            scopeLineNumber,
            copyDocument,
            copyPendingDocuments
          );

          // 초기화
          if (!isStartFunctionScope) {
            isFunctionScope = true;
          } else {
            isFunctionScope = false;
          }
          isStartFunctionScope = false;
          isFinishFunctionScope = false;
          scopeLineNumber = 0;
          scopeText = "";

          // 스코프 tokens 추가
          results.push(...parsedTextResults.tokens);

          continue;
        }

        // tokenData, currentOffset 초기화
        tokenData = null;
        currentOffset = 0;

        // 공백처리 , 주석처리 , 빈줄처리
        const validatedLineResults = cleanLine(line, isCommenting);
        const isSkip = validatedLineResults.isSkip;
        isCommenting = validatedLineResults.isCommenting;

        if (isSkip || isCommenting) {
          continue;
        }

        const trimedLineResults = cleanBlank(line);
        let trimedLine = trimedLineResults.line;
        currentOffset = trimedLineResults.count;

        // undefined 처리
        if (trimedLine.split(" ").length === 2) {
          trimedLine = helper.handleUndefinedType(trimedLine);

          if (!trimedLine) {
            continue;
          }
        }

        const removedCommentLineResults = cleanComment(
          trimedLine,
          currentOffset
        );
        const convertedLineArray = removedCommentLineResults.line.split("=");
        currentOffset = removedCommentLineResults.count;

        // 변수 , 값 분류
        let declarationArea = convertedLineArray[0].split(" ");
        let definitionArea = convertedLineArray[1].trim();

        // 변수 시작 , 종료 위치
        let startPos = 0;
        let endPos = 0;

        if (isExport) {
          startPos =
            currentOffset +
            declarationArea[0].length +
            declarationArea[1].length +
            2;
          endPos = startPos + declarationArea[2].length;
          declarationArea = declarationArea.slice(1);
          isExport = false;
        } else {
          startPos = currentOffset + declarationArea[0].length + 1;
          endPos = startPos + declarationArea[1].length;
        }

        // 변수의 값으로 Type 체크 tokenData 생성
        tokenData = helper.handleLineTypeValidate(definitionArea);

        // Number Multiline , String Multiline
        if (definitionArea.slice(-1) !== ";") {
          tempraryParsedText.declarationArea = declarationArea;
          tempraryParsedText.definitionArea = definitionArea;
          tempraryParsedText.line = i + start;
          tempraryParsedText.startPos = startPos;
          tempraryParsedText.endPos = endPos;
          tempraryParsedText.length = endPos - startPos;
          tempraryParsedText.value = definitionArea;

          isContinue = true;

          continue;
        }

        // array.length , array[index] , object.property
        if (!tokenData) {
          if (
            definitionArea.endsWith("length;") &&
            definitionArea.includes(".")
          ) {
            // length 경우
            const variableName = definitionArea.slice(0, -1).split(".")[0];

            if (
              documents[variableName].slice(-1)[0].tokenData
                .tokenModifiers[1] === "string" ||
              documents[variableName].slice(-1)[0].tokenData
                .tokenModifiers[1] === "array"
            ) {
              tokenData = parseToken("number");
            }
          } else if (definitionArea.endsWith("];")) {
            // array[index] 경우
            const arrayName = definitionArea.split("[")[0];
            const indexList = definitionArea
              .split("[")
              .slice(1)
              .map((index) => {
                return index.replace("]", "").replace(";", "");
              });
            const value = documents[arrayName].slice(-1)[0].value;
            const resultArray = helper.handleArrayCreate(value)[0];
            let result = null;

            indexList.forEach((index) => {
              if (!result) {
                result = resultArray[index];
              } else {
                result = result[index];
              }
            });

            if (Array.isArray(result)) {
              tokenData = parseToken("array");
            } else {
              tokenData = helper.handleLineTypeValidate(result + ";");
            }

            if (!tokenData && documents[result]) {
              tokenData = documents[result].slice(-1)[0].tokenData;
            }
          } else if (
            definitionArea.includes(".") &&
            definitionArea.slice(0, -1).split(".")[1]
          ) {
            // object.property
            const data = definitionArea.slice(0, -1).split(".");
            const objName = data[0];
            const propertys = data.slice(1);
            const value = documents[objName]
              .slice(-1)[0]
              .value.trim()
              .slice(0, -1);

            const obj = helper.handleObjectEvaluate(value);

            let currentValue = null;

            if (obj) {
              propertys.forEach((property) => {
                if (!currentValue) {
                  currentValue = obj[property];
                } else {
                  currentValue = currentValue[property];
                }

                let type = typeof currentValue;

                if (Array.isArray(currentValue)) {
                  type = "array";
                }

                tokenData = parseToken(type);

                if (!tokenData) {
                  currentValue = documents[property];
                }
              });
            }
          }
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
                line: i + start,
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
              const latestVariableInfo =
                documents[variableInValue].slice(-1)[0];
              tokenData = latestVariableInfo.tokenData;

              documents[variableName] = [
                {
                  statement,
                  value: latestVariableInfo.value,
                  line: i + start,
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
                    line: i + start,
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
                  line: i + start,
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
            line: i + start,
            startPos,
            endPos,
            length: endPos - startPos,
            tokenData,
          });
        } else if (documents[declarationArea.slice(0, -1)] && !tokenData) {
          // else if : 변수 = 변수를 할당할 때
          const variableName = declarationArea[0];
          const variableInValue = definitionArea.slice(0, -1);
          const statement =
            documents[declarationArea.slice(0, -1)][0].statement;
          let latestVariableInfo = null;
          startPos = endPos - variableName.length - 1;

          if (documents[variableInValue]) {
            // 선언 O 변수
            latestVariableInfo = documents[variableInValue].slice(-1)[0];
            tokenData = latestVariableInfo.tokenData;

            documents[variableName].push({
              value: latestVariableInfo.value,
              line: i + start,
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
                  line: i + start,
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
                line: i + start,
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
            line: i + start,
            startCharacter: startPos,
            length: endPos - startPos,
            tokenType: tokenData.tokenType,
            tokenModifiers: tokenData.tokenModifiers,
          });
        }
      } catch (error) {
        continue;
      }
    }

    // console.log("\n");
    // console.log("최종결과 Pendong Documents : ", pendingDocuments);
    // console.log("최종결과 Documents : ", documents);
    // console.log("최종결과 Results : ", results);

    return {
      tokens: results,
      dom: documents,
      pendingDom: pendingDocuments,
    };
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
  function handleLineTypeValidate(value) {
    let tokenData = null;
    const checkFunctions = [
      checkBooleanType,
      checkNumberType,
      checkStringType,
      checkNullType,
      checkUndefinedType,
      checkArrayType,
      checkObjectType,
    ];
    const types = [
      "boolean",
      "number",
      "string",
      "null",
      "undefined",
      "array",
      "object",
    ];

    for (let i = 0; i < checkFunctions.length; i++) {
      if (checkFunctions[i](value)) {
        tokenData = provider.parseToken(types[i]);
        return tokenData;
      }
    }

    return tokenData;
  }

  function handleUndefinedType(value) {
    const hasSemicolon = value.trim().slice(-1) === ";";
    let splitedValue = value.trim().split(" ");

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

  function handleArrayCreate(value) {
    const queue = value.slice().split("");
    let bracketPoint = -1;

    return (function makeArray() {
      let results = [];
      let sum = "";

      while (queue.length) {
        const char = queue.shift();

        if (char === "{") {
          bracketPoint += 1;
        }

        if (char === "}") {
          bracketPoint -= 1;
        }

        if (char === "[" && bracketPoint === -1) {
          results = [...results, [...makeArray()]];
          continue;
        }

        if (char === "]" && bracketPoint === -1) {
          if (sum !== " ") {
            results.push(sum.trim());
          }
          sum = "";
          break;
        }

        if (char === "," && bracketPoint === -1) {
          if (sum !== " ") {
            results.push(sum.trim());
          }
          sum = "";
          continue;
        }

        sum += char;
      }

      return results;
    })();
  }

  function handleObjectEvaluate(value) {
    try {
      const func = new Function(`return ${value};`);
      return func();
    } catch (error) {
      return null;
    }
  }

  function handleScopeCreate(
    value,
    isStartScope,
    isFinishScope,
    isScope,
    isStartFunctionScope,
    isFinishFunctionScope,
    isFunctionScope
  ) {
    if (
      value.includes("if (") ||
      value.includes("else if (") ||
      (value.includes("else {") && !isScope) ||
      value.includes("for (") ||
      value.includes("while (")
    ) {
      isStartScope = true;
    }

    if (value.includes("function") && value.includes("(")) {
      isStartFunctionScope = true;
    }

    if (value.trim() === "}") {
      if (isFunctionScope) {
        isFinishFunctionScope = true;
        isStartFunctionScope = true;
        isFunctionScope = false;
      } else {
        isFinishScope = true;
        isStartScope = true;
        isScope = false;
      }
    } else if (
      value.includes("if (") ||
      value.includes("else if (") ||
      value.includes("else {") ||
      (value.includes("for (") && isScope) ||
      (value.includes("while (") && isScope)
    ) {
      isStartScope = false;
      isFinishScope = true;
    } else if (
      value.includes("function") &&
      value.includes("(") &&
      isFunctionScope
    ) {
      isStartFunctionScope = false;
      isFinishFunctionScope = true;
    }

    return {
      isStartScope,
      isFinishScope,
      isScope,
      isStartFunctionScope,
      isFinishFunctionScope,
      isFunctionScope,
    };
  }

  function handleFunctionScopeCreate(
    value,
    isStartFunctionScope,
    isFinishFunctionScope
  ) {
    if (value.includes("function")) {
      isStartFunctionScope = true;
    } else if (value.trim() === "}") {
      isFinishFunctionScope = true;
    }

    return {
      isStartFunctionScope,
      isFinishFunctionScope,
    };
  }

  return {
    handleLineTypeValidate,
    handleUndefinedType,
    handleArrayCreate,
    handleObjectEvaluate,
    handleScopeCreate,
    handleFunctionScopeCreate,
  };
}

module.exports = provider;
