"use strict";

const vscode = require("vscode");
const fs = require("fs");

const { tokenTypes, tokenModifiers } = require("./legend");
const constants = require("./helper/constants");
const { cleanLine, cleanBlank, cleanComment } = require("./helper/cleanUp");

const {
  checkBooleanType,
  checkNumberType,
  checkStringType,
  checkNullType,
  checkUndefinedType,
  checkArrayType,
  checkObjectType,
} = require("./helper/type");

const { findValueInKeyFromStringTypeObject } = require("./helper/utils");

const provider = makeProvider();
const helper = makeProvdierHelper();

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

  function encodeTokenType(tokenType, types) {
    const tokenTypeList = types === undefined ? tokenTypes : types;

    if (tokenTypeList.has(tokenType)) {
      return tokenTypeList.get(tokenType);
    }

    return 0;
  }

  function encodeTokenModifiers(strTokenModifiers, modifiers) {
    const modifierList = modifiers === undefined ? tokenModifiers : modifiers;
    let result = 0;

    for (let i = 0; i < strTokenModifiers.length; i++) {
      const tokenModifier = strTokenModifiers[i];

      if (modifierList.has(tokenModifier)) {
        result = result | (1 << modifierList.get(tokenModifier));
      }
    }

    return result;
  }

  function parseToken(type) {
    return {
      tokenType: constants.TYPE,
      tokenModifiers: [constants.DECLARATION, `${type}`],
    };
  }

  function parseText(text, start, uri) {
    const path =
      uri === undefined
        ? vscode.window.activeTextEditor.document.uri.fsPath
        : uri;

    const lines = text.split(constants.REG_EX_LINE);
    let results = [];

    let documents = {};
    let pendingDocuments = {};
    let tempraryParsedText = {};
    let tokenData = null;

    let isCommenting = false;
    let isContinue = false;

    let isExport = false;
    let isStartImport = false;
    let isFinishImport = false;
    let importText = constants.NONE;

    let currentOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        const line = lines[i];

        const resultImport = helper.handleImportParse(
          documents,
          path,
          line,
          importText,
          isFinishImport
        );

        documents = resultImport.documents;
        isFinishImport = resultImport.isFinishImport;
        importText = resultImport.importText;

        if (resultImport.isImport) {
          continue;
        }

        if (line.startsWith(constants.IMPORT_START) || isStartImport) {
          isStartImport = true;
          importText += constants.BLANK + line;

          if (line.endsWith(constants.IMPORT_EXP_JS)) {
            isStartImport = false;
            isFinishImport = true;
          }

          continue;
        }

        if (
          line.startsWith(constants.EXPORT) &&
          line.includes(constants.EQUAL)
        ) {
          isExport = true;
        }

        if (line.startsWith(constants.EXPORT_DEFAULT)) {
          continue;
        }

        if (isContinue && line) {
          tempraryParsedText.value += line;

          if (line.slice(-1) === constants.SEMI_COLON) {
            const parsedMultiline = helper.handleMultilineParse(
              results,
              documents,
              tempraryParsedText,
              tokenData
            );

            results = parsedMultiline.results;
            documents = parsedMultiline.documents;
            tokenData = parsedMultiline.tokenData;
            tempraryParsedText = {};
            isContinue = false;
          }

          continue;
        }

        tokenData = null;
        currentOffset = 0;

        const validatedLineResults = cleanLine(line, isCommenting);
        const isSkip = validatedLineResults.isSkip;
        const isExpression = helper.handleBlockAndFunctionExpressionCheck(line);
        isCommenting = validatedLineResults.isCommenting;

        if (isSkip || isCommenting || isExpression) {
          continue;
        }

        const trimedLineResults = cleanBlank(line);
        let trimedLine = trimedLineResults.line;
        currentOffset = trimedLineResults.count;

        if (trimedLine.split(constants.BLANK).length < 3) {
          trimedLine = helper.handleUndefinedType(trimedLine);

          if (!trimedLine) {
            continue;
          }
        }

        const removedCommentLineResults = cleanComment(
          trimedLine,
          currentOffset
        );

        const convertedLineArray = removedCommentLineResults.line.split(
          constants.EQUAL
        );

        currentOffset = removedCommentLineResults.count;

        let declarationArea = convertedLineArray[0].split(constants.BLANK);
        let definitionArea = convertedLineArray[1].trim();
        let startPos = 0;
        let endPos = 0;

        definitionArea = helper.handleDefinitionAreaOperation(
          documents,
          definitionArea
        );

        tokenData = helper.handleLineTypeValidate(definitionArea);

        if (!tokenData) {
          const multipleOperationResult =
            helper.handleMultipleOperation(definitionArea);

          if (multipleOperationResult && multipleOperationResult.tokenData) {
            tokenData = multipleOperationResult.tokenData;
            definitionArea =
              multipleOperationResult.value + constants.SEMI_COLON;
          }
        }

        if (isExport) {
          const exportStringLength = declarationArea[0].length;
          const statementLength = declarationArea[1].length;
          const variableNameLength = declarationArea[2].length;

          startPos = currentOffset + exportStringLength + statementLength + 2;
          endPos = startPos + variableNameLength;
          declarationArea = declarationArea.slice(1);
          isExport = false;
        } else {
          const statementLength = declarationArea[0].length;
          const variableNameLength = declarationArea[1].length;

          startPos = currentOffset + statementLength + 1;
          endPos = startPos + variableNameLength;
        }

        if (definitionArea.slice(-1) !== constants.SEMI_COLON) {
          tempraryParsedText = {
            declarationArea: declarationArea,
            definitionArea: definitionArea,
            line: i + start,
            startPos: startPos,
            endPos: endPos,
            length: endPos - startPos,
            value: definitionArea,
          };

          isContinue = true;

          continue;
        } else if (
          declarationArea[1] === constants.PLUS ||
          declarationArea[1] === constants.MINUS ||
          declarationArea
            .join(constants.BLANK)
            .includes(constants.EXPRESSION_FOR)
        ) {
          continue;
        }

        if (!tokenData) {
          const addPropertyResult = helper.handleArrayAndObjectPropertyCreate(
            documents,
            tokenData,
            definitionArea
          );

          documents = addPropertyResult.documents;
          tokenData = addPropertyResult.tokenData;
        }

        const parsedVariableAndValueResult = helper.handleVariableAndValueParse(
          results,
          documents,
          pendingDocuments,
          tokenData,
          declarationArea,
          definitionArea,
          i,
          start,
          startPos,
          endPos
        );

        results = parsedVariableAndValueResult.results;
        documents = parsedVariableAndValueResult.documents;
        pendingDocuments = parsedVariableAndValueResult.pendingDocuments;
        tokenData = parsedVariableAndValueResult.tokenData;
        startPos = parsedVariableAndValueResult.startPos;
        endPos = parsedVariableAndValueResult.endPos;

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

function makeProvdierHelper() {
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
      constants.BOOLEAN,
      constants.NUMBER,
      constants.STRING,
      constants.NULL,
      constants.UNDEFINED,
      constants.ARRAY,
      constants.OBJECT,
    ];

    for (let i = 0; i < checkFunctions.length; i++) {
      if (checkFunctions[i](value)) {
        tokenData = provider.parseToken(types[i]);
        return tokenData;
      }
    }

    return tokenData;
  }

  function handleMultilineParse(
    results,
    documents,
    tempraryParsedText,
    tokenData
  ) {
    tokenData = handleLineTypeValidate(tempraryParsedText.value);
    const declarationArea = tempraryParsedText.declarationArea;
    const definitionArea = tempraryParsedText.value;

    if (
      declarationArea[0] === constants.STATEMENT_CONST ||
      declarationArea[0] === constants.STATEMENT_LET ||
      declarationArea[0] === constants.STATEMENT_VAR
    ) {
      const statement = declarationArea[0];
      const variableName = declarationArea[1];
      const value = definitionArea;

      documents[variableName] = [
        {
          statement,
          value,
          line: tempraryParsedText.line,
          startPos: tempraryParsedText.startPos,
          endPos: tempraryParsedText.endPos,
          length: tempraryParsedText.length,
          tokenData,
        },
      ];
    } else if (
      documents[declarationArea[0]] &&
      documents[declarationArea[0]][0].statement !==
        constants.STATEMENT_CONST &&
      tokenData
    ) {
      const variableName = declarationArea[0];
      const value = definitionArea;

      tempraryParsedText.startPos =
        tempraryParsedText.endPos - variableName.length - 1;

      documents[variableName].push({
        value,
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

    return {
      results,
      documents,
      tokenData,
    };
  }

  function handleBlockAndFunctionExpressionCheck(value) {
    const syntaxArray = [
      constants.EXPRESSION_IF,
      constants.EXPRESSION_ELSE_IF,
      constants.EXPRESSION_ELSE,
      constants.EXPRESSION_FOR,
      constants.EXPRESSION_WHILE,
      constants.EXPRESSION_FUNCTION,
    ];
    const isContain = syntaxArray.some((syntax) => {
      return value.includes(syntax) === true;
    });

    return isContain;
  }

  function handleUndefinedType(value) {
    const hasSemicolon = value.trim().slice(-1) === constants.SEMI_COLON;
    let splitedValue = value.trim().split(constants.BLANK);

    if (
      hasSemicolon &&
      (splitedValue[0] === constants.STATEMENT_VAR ||
        splitedValue[0] === constants.STATEMENT_LET)
    ) {
      splitedValue[1] = splitedValue[1].slice(0, -1);
      splitedValue[2] = constants.EQUAL;
      splitedValue[3] = constants.UNDEFINED + constants.SEMI_COLON;

      return splitedValue.join(constants.BLANK);
    }

    return constants.NONE;
  }

  function handleArrayCreate(value) {
    const queue = value.slice().split(constants.NONE);
    let bracketPoint = -1;

    return (function makeArray() {
      let results = [];
      let sum = constants.NONE;

      while (queue.length) {
        const char = queue.shift();

        if (char === constants.BRACE_START) {
          bracketPoint += 1;
        }

        if (char === constants.BRACE_END) {
          bracketPoint -= 1;
        }

        if (char === constants.BRACKET_START && bracketPoint === -1) {
          results = [...results, [...makeArray()]];

          continue;
        }

        if (char === constants.BRACKET_END && bracketPoint === -1) {
          if (sum !== constants.BLANK) {
            results.push(sum.trim());
          }

          sum = constants.NONE;

          break;
        }

        if (char === constants.COMMA && bracketPoint === -1) {
          if (sum !== constants.BLANK) {
            results.push(sum.trim());
          }

          sum = constants.NONE;

          continue;
        }

        sum += char;
      }

      return results;
    })();
  }

  function handleObjectEvaluate(documents, objName, value) {
    try {
      const func = Function(`return ${value};`);

      return func();
    } catch (error) {
      return documents[objName].slice(-1)[0].value;
    }
  }

  function handleDefinitionAreaOperation(documents, value) {
    const symbols = [
      constants.PLUS,
      constants.MINUS,
      constants.MULTIPLY,
      constants.DIVISION,
      constants.REMAIN,
    ];
    let definitionArea = value;

    symbols.forEach((symbol) => {
      if (definitionArea.includes(symbol)) {
        definitionArea =
          definitionArea
            .split(symbol)
            .map((value) => {
              if (value.includes(constants.SEMI_COLON)) {
                value = value.replace(constants.SEMI_COLON, constants.NONE);
              }

              if (documents[value.trim()]) {
                const document = documents[value.trim()].slice(-1)[0];

                value = document.value.replace(
                  constants.SEMI_COLON,
                  constants.NONE
                );

                if (document.tokenData.tokenModifiers[1] === constants.STRING) {
                  value = `${value}`;
                }
              }

              return value;
            })
            .join(symbol) + constants.SEMI_COLON;
      }
    });

    return definitionArea;
  }

  function handleMultipleOperation(text) {
    try {
      const result = Function(`return ${text};`)();
      let tokenData = null;
      let value;

      if (Array.isArray(result)) {
        tokenData = provider.parseToken(constants.ARRAY);
        value = result;
      } else if (typeof result === constants.OBJECT && result === null) {
        tokenData = provider.parseToken(constants.NULL);
        value = result;
      } else {
        tokenData = provider.parseToken(typeof result);
        value = result;
      }

      return {
        tokenData,
        value,
      };
    } catch (error) {
      return null;
    }
  }

  function handleArrayAndObjectPropertyCreate(
    documents,
    tokenData,
    definitionArea
  ) {
    if (
      definitionArea.endsWith(constants.LENGTH + constants.SEMI_COLON) &&
      definitionArea.includes(constants.PERIOD)
    ) {
      if (
        (!definitionArea.includes(constants.BRACKET_START) &&
          !definitionArea.includes(constants.BRACKET_END)) ||
        definitionArea.includes(constants.COMMA)
      ) {
        const value = definitionArea.slice(0, -1).split(constants.PERIOD)[0];
        let type = handleLineTypeValidate(value + constants.SEMI_COLON);

        if (type) {
          type = type.tokenModifiers[1];
        }

        if (
          type === constants.STRING ||
          type === constants.ARRAY ||
          documents[value].slice(-1)[0].tokenData.tokenModifiers[1] ===
            constants.STRING ||
          documents[value].slice(-1)[0].tokenData.tokenModifiers[1] ===
            constants.ARRAY
        ) {
          tokenData = provider.parseToken(constants.NUMBER);
        }
      } else {
        const arrayName = definitionArea.split(constants.BRACKET_START)[0];
        const decompositedList = [];

        definitionArea
          .split(constants.BRACKET_START)
          .slice(1)
          .map((item) => {
            return item
              .replace(constants.BRACKET_END, constants.NONE)
              .replace(constants.SEMI_COLON, constants.NONE)
              .split(constants.PERIOD);
          })
          .forEach((array) => {
            array.forEach((item) => {
              decompositedList.push(item);
            });
          });

        const value = documents[arrayName].slice(-1)[0].value;
        const resultArray = handleArrayCreate(value)[0];
        let result = null;
        const hasLength = decompositedList.slice(-1)[0] === constants.LENGTH;

        decompositedList.forEach((item) => {
          if (!result && item !== constants.LENGTH) {
            result = resultArray[item];
          } else if (item !== constants.LENGTH) {
            result = result[item];
          }
        });

        if (Array.isArray(result)) {
          if (hasLength) {
            tokenData = provider.parseToken(constants.NUMBER);
          } else {
            tokenData = provider.parseToken(constants.ARRAY);
          }
        } else {
          tokenData = handleLineTypeValidate(result + constants.SEMI_COLON);

          if (hasLength && tokenData) {
            if (tokenData.tokenModifiers[1] === constants.STRING) {
              tokenData = provider.parseToken(constants.NUMBER);
            } else {
              tokenData = null;
            }
          }
        }

        if (!tokenData && documents[result]) {
          tokenData = documents[result].slice(-1)[0].tokenData;
        }
      }
    } else if (
      definitionArea.endsWith(constants.BRACKET_END + constants.SEMI_COLON)
    ) {
      const arrayName = definitionArea.split(constants.BRACKET_START)[0];
      const indexList = definitionArea
        .split(constants.BRACKET_START)
        .slice(1)
        .map((index) => {
          return index
            .replace(constants.BRACKET_END, constants.NONE)
            .replace(constants.SEMI_COLON, constants.NONE);
        });
      let value = documents[arrayName].slice(-1)[0].value;
      value =
        value.includes(constants.BRACKET_START) &&
        value.includes(constants.BRACKET_END)
          ? documents[arrayName].slice(-1)[0].value
          : `[${documents[arrayName].slice(-1)[0].value.slice(0, -1)}];`;

      const resultArray = handleArrayCreate(value)[0];
      let result = null;

      indexList.forEach((index) => {
        if (!result) {
          result = resultArray[index];
        } else {
          result = result[index];
        }
      });

      if (Array.isArray(result)) {
        tokenData = provider.parseToken(constants.ARRAY);
      } else {
        tokenData = handleLineTypeValidate(result + constants.SEMI_COLON);
      }

      if (!tokenData && documents[result]) {
        tokenData = documents[result].slice(-1)[0].tokenData;
      }
    } else if (
      definitionArea.includes(constants.PERIOD) &&
      definitionArea.slice(0, -1).split(constants.PERIOD)[1]
    ) {
      const data = definitionArea.slice(0, -1).split(constants.PERIOD);
      const objName = data[0];
      const properties = data.slice(1);
      const value = documents[objName].slice(-1)[0].value.trim().slice(0, -1);
      const obj = handleObjectEvaluate(documents, objName, value);
      let currentValue = null;

      if (typeof obj === constants.OBJECT) {
        properties.forEach((property) => {
          if (!currentValue) {
            currentValue = obj[property];
          } else {
            currentValue = currentValue[property];
          }

          let type = typeof currentValue;

          if (Array.isArray(currentValue)) {
            type = constants.ARRAY;
          }

          tokenData = provider.parseToken(type);

          if (!tokenData) {
            currentValue = documents[property];
          }
        });
      } else if (typeof obj === constants.STRING) {
        const results = findValueInKeyFromStringTypeObject(properties, obj);

        results.forEach((value) => {
          let objValue = value;

          if (objValue.includes(constants.BRACE_START)) {
            objValue += constants.BRACE_END;
          } else if (objValue.includes(constants.BRACKET_START)) {
            objValue += constants.BRACKET_END;
          }

          if (results.length) {
            if (documents[objValue]) {
              const type =
                documents[objValue].slice(-1)[0].tokenData.tokenModifiers[1];
              const value = documents[objValue].slice(-1)[0].value;

              tokenData = handleLineTypeValidate(
                value.includes(constants.SEMI_COLON)
                  ? value
                  : value + constants.SEMI_COLON
              );

              if (!tokenData) {
                tokenData = provider.parseToken(type);
              }
            } else {
              tokenData = handleLineTypeValidate(
                objValue + constants.SEMI_COLON
              );
            }
          } else {
            tokenData = null;
          }
        });
      }
    }

    return {
      documents,
      tokenData,
    };
  }

  function handleImportParse(
    documents,
    path,
    value,
    multilineValue,
    isFinishImport
  ) {
    if (
      (value.startsWith(constants.IMPORT_START) &&
        value.endsWith(constants.IMPORT_EXP_JS)) ||
      isFinishImport
    ) {
      const code = multilineValue === constants.NONE ? value : multilineValue;

      const filteredLineArry = code
        .slice(0, -1)
        .replace(constants.IMPORT_START, constants.NONE)
        .replace(constants.IMPORT_END, constants.NONE)
        .replace(constants.BRACE_START, constants.NONE)
        .replace(constants.BRACE_END, constants.NONE)
        .replaceAll(constants.COMMA, constants.NONE)
        .split(constants.BLANK)
        .filter((item) => item !== constants.NONE);

      const importPath = filteredLineArry
        .slice(-1)[0]
        .replaceAll(constants.PERIOD, constants.NONE)
        .split(constants.LANGUAGE_SHORT_JS)
        .join(constants.PERIOD + constants.LANGUAGE_SHORT_JS)
        .slice(1, -1);

      const slashCount =
        importPath.split(constants.SLASH).length -
        (importPath.split(constants.SLASH).length - 1);

      const importCode = fs.readFileSync(
        path
          .split(constants.SLASH)
          .slice(0, -slashCount)
          .join(constants.SLASH) + importPath,
        constants.ENCODING_UTF8
      );

      const parsedImportDocuments = provider.parseText(importCode, 0).dom;

      const exportVariableNames = importCode
        .split(constants.REG_EX_LINE)
        .filter((line) => {
          return (
            (line.includes(constants.EXPORT) &&
              line.includes(constants.EQUAL)) ||
            line.includes(constants.EXPORT_DEFAULT)
          );
        })
        .map((line) => {
          return line.split(constants.BLANK)[2];
        });

      const startIndex = code.indexOf(constants.BRACE_START);
      const endIndex = code.indexOf(constants.BRACE_END);

      const isExistBracket = startIndex !== -1 ? true : false;
      let importVariableName = constants.NONE;
      let exportVariableName = constants.NONE;

      if (!isExistBracket) {
        importVariableName = code
          .trim()
          .split(constants.BLANK)
          .map((item, index, array) => {
            if (item === constants.IMPORT_START) {
              return array[index + 1];
            }
          })
          .filter((item) => item !== undefined);

        importVariableName =
          importVariableName.length === 1
            ? importVariableName[0]
            : constants.NONE;
      } else {
        importVariableName = code
          .substring(0, startIndex)
          .trim()
          .replace(constants.COMMA, constants.NONE)
          .split(constants.BLANK)
          .map((item, index, array) => {
            if (item === constants.IMPORT_START) {
              return array[index + 1];
            }
          })
          .filter((item) => item !== undefined);

        importVariableName =
          importVariableName.length === 1
            ? importVariableName[0]
            : constants.NONE;
      }

      const importVariableNames = code
        .substring(startIndex, endIndex + 1)
        .slice(1, -1)
        .split(constants.COMMA)
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

      isFinishImport = false;
      multilineValue = constants.NONE;

      return {
        documents,
        isFinishImport,
        importText: multilineValue,
        isImport: true,
      };
    }

    return {
      documents,
      isFinishImport,
      importText: multilineValue,
      isImport: false,
    };
  }

  function handleVariableAndValueParse(
    results,
    documents,
    pendingDocuments,
    tokenData,
    declarationArea,
    definitionArea,
    i,
    start,
    startPos,
    endPos
  ) {
    if (
      declarationArea[0] === constants.STATEMENT_VAR ||
      declarationArea[0] === constants.STATEMENT_LET ||
      declarationArea[0] === constants.STATEMENT_CONST
    ) {
      const variableName = declarationArea[1];
      const statement = declarationArea[0];
      const variableInValue = definitionArea.slice(0, -1);

      if (tokenData) {
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
        if (documents[variableInValue]) {
          const latestVariableInfo = documents[variableInValue].slice(-1)[0];
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

      if (
        pendingDocuments[variableName] &&
        statement === constants.STATEMENT_VAR
      ) {
        while (pendingDocuments[variableName].length) {
          const pendingDocument = pendingDocuments[variableName].shift();
          const tempTokenData = provider.parseToken(constants.UNDEFINED);

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
      documents[declarationArea[0]][0].statement !==
        constants.STATEMENT_CONST &&
      tokenData
    ) {
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
      const variableName = declarationArea[0];
      const variableInValue = definitionArea.slice(0, -1);
      const statement = documents[declarationArea.slice(0, -1)][0].statement;
      let latestVariableInfo = null;
      startPos = endPos - variableName.length - 1;

      if (documents[variableInValue]) {
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

      if (
        pendingDocuments[variableName] &&
        statement !== constants.STATEMENT_CONST
      ) {
        while (pendingDocuments[variableName].length) {
          const pendingDocument = pendingDocuments[variableName].shift();
          const tempTokenData = provider.parseToken(constants.UNDEFINED);

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

    return {
      results,
      documents,
      pendingDocuments,
      tokenData,
      startPos,
      endPos,
    };
  }

  return {
    handleLineTypeValidate,
    handleMultilineParse,
    handleUndefinedType,
    handleBlockAndFunctionExpressionCheck,
    handleArrayCreate,
    handleObjectEvaluate,
    handleDefinitionAreaOperation,
    handleMultipleOperation,
    handleArrayAndObjectPropertyCreate,
    handleImportParse,
    handleVariableAndValueParse,
  };
}

module.exports = provider;
