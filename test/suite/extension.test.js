const assert = require("assert");
const path = require("path");
const vscode = require("vscode");

const provider = require("../../src/provider");
const { legend } = require("../../src/legend");
const constants = require("../../src/helper/constants");

const {
  sleep,
  findValueInKeyFromStringTypeObject,
} = require("../../src/helper/utils");

const {
  cleanBlank,
  cleanComment,
  cleanLine,
} = require("../../src/helper/cleanUp");

const {
  checkStringType,
  checkNumberType,
  checkNullType,
  checkUndefinedType,
  checkArrayType,
  checkObjectType,
  checkBooleanType,
} = require("../../src/helper/type");

suite("extension 테스트", () => {
  test("legend 테스트", () => {
    const tokenTypes = legend.tokenTypes;
    const tokenModifiers = legend.tokenModifiers;

    const newLegend = new vscode.SemanticTokensLegend(
      tokenTypes,
      tokenModifiers
    );

    assert.equal(Array.isArray(tokenTypes), true);
    assert.equal(Array.isArray(tokenModifiers), true);
    assert.equal(newLegend instanceof vscode.SemanticTokensLegend, true);
  });

  test("provider 테스트", async () => {
    const tokenTypes = new Map();
    const tokenTypesLegend = [constants.TYPE, constants.TEST];

    const tokenModifiers = new Map();
    const tokenModifiersLegend = [
      constants.TEST,
      constants.DECLARATION,
      constants.BOOLEAN,
      constants.STRING,
      constants.NUMBER,
      constants.NULL,
      constants.UNDEFINED,
      constants.ARRAY,
      constants.OBJECT,
    ];

    const dirName =
      __dirname.split(constants.SLASH).slice(0, -1).join(constants.SLASH) +
      "/mockup/";

    const fileName = "sample.js";
    const uri = vscode.Uri.file(path.join(dirName + fileName));
    const document = await vscode.workspace.openTextDocument(uri);

    await sleep(500);

    const encodeTokenType = provider.encodeTokenType;
    const encodeTokenModifiers = provider.encodeTokenModifiers;
    const parseToken = provider.parseToken;
    const parseText = provider.parseText;
    const provideDocumentSemanticTokens = async function () {
      const allTokens = parseText(document.getText(), 0, uri).tokens;
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
    };

    tokenTypesLegend.forEach((tokenType, index) =>
      tokenTypes.set(tokenType, index)
    );

    tokenModifiersLegend.forEach((tokenModifier, index) =>
      tokenModifiers.set(tokenModifier, index)
    );

    const token = parseToken(constants.TEST);
    const documentSemanticTokens = await provideDocumentSemanticTokens();
    const tokens = parseText(document.getText(), 0, uri).tokens;
    const dom = parseText(document.getText(), 0, uri).dom;

    assert.equal(uri.scheme, constants.SCHEME_FILE);

    assert.equal(encodeTokenType(constants.TEST, tokenTypes) === 1, true);
    assert.equal(encodeTokenType(constants.TEST, tokenTypes) === 0, false);

    assert.equal(
      encodeTokenModifiers([constants.TEST], tokenModifiers) === 1,
      true
    );
    assert.equal(
      encodeTokenModifiers([constants.TEST], tokenModifiers) === 2,
      false
    );

    assert(token.tokenType === constants.TYPE, true);
    assert(token.tokenModifiers[0] === constants.DECLARATION, true);
    assert(token.tokenModifiers[1] === constants.TEST, true);

    assert.equal(documentSemanticTokens instanceof vscode.SemanticTokens, true);

    assert.equal(tokens.length === 7, true);
    assert.equal(Object.keys(dom).length === 7, true);
  });
});

suite("cleanUp 함수 테스트", () => {
  test("cleanLine 테스트", () => {
    const textA = "// 주석처리";
    const isCommentA = false;

    const textB = "/* aaa bbb";
    const isCommentB = false;

    const resultA = cleanLine(textA, isCommentA);
    const isSkipA = resultA.isSkip;
    const isCommentingA = resultA.isCommenting;

    const resultB = cleanLine(textB, isCommentB);
    const isSkipB = resultB.isSkip;
    const isCommentingB = resultB.isCommenting;

    assert.equal(isSkipA, true);
    assert.equal(isCommentingA, false);

    assert.equal(isSkipB, true);
    assert.equal(isCommentingB, true);
  });

  test("cleanBlank 테스트", () => {
    const text = "const sample = 100;";
    const textA = " const sample = 100;";

    const resultA = cleanBlank(textA);
    const lineA = resultA.line;
    const blankCount = resultA.count;

    assert.equal(lineA === text, true);
    assert.equal(blankCount === 1, true);
  });

  test("cleanComment 테스트", () => {
    const text = "const sample = 'sample';";

    const textA = "//     const sample = 'sample';";
    const currentOffsetA = 0;

    const textB = "/**/const sample = 'sample';";
    const currentOffsetB = 0;

    const resultA = cleanComment(textA, currentOffsetA);
    const lineA = resultA.line;
    const countA = resultA.count;

    const resultB = cleanComment(textB, currentOffsetB);
    const lineB = resultB.line;
    const countB = resultB.count;

    assert.equal(lineA === textA, true);
    assert.equal(countA === 0, true);
    assert.equal(lineB === text, true);
    assert.equal(countB === 4, true);
  });
});

suite("type 함수 테스트", () => {
  test("checkBoolean 테스트", () => {
    const testA = "true;";
    const testB = "false;";
    const testC = "!true;";
    const testD = "'true';";

    const resultA = checkBooleanType(testA);
    const resultB = checkBooleanType(testB);
    const resultC = checkBooleanType(testC);
    const resultD = checkBooleanType(testD);

    assert.equal(resultA, true);
    assert.equal(resultB, true);
    assert.equal(resultC, true);
    assert.equal(resultD, false);
  });

  test("checkNumberType 테스트", () => {
    const testA = "100;";
    const testB = "'100;'";

    const resultA = checkNumberType(testA);
    const resultB = checkNumberType(testB);

    assert.equal(resultA, true);
    assert.equal(resultB, false);
  });

  test("checkStringType 테스트", () => {
    const testA = "100;";
    const testB = '"string type";';

    const resultA = checkStringType(testA);
    const resultB = checkStringType(testB);

    assert.equal(resultA, false);
    assert.equal(resultB, true);
  });

  test("checkNullType 테스트", () => {
    const testA = "null;";
    const testB = '"null";';

    const resultA = checkNullType(testA);
    const resultB = checkNullType(testB);

    assert.equal(resultA, true);
    assert.equal(resultB, false);
  });

  test("checkUndefinedType 테스트", () => {
    const testA = '"undefined";';
    const testB = "undefined;";

    const resultA = checkUndefinedType(testA);
    const resultB = checkUndefinedType(testB);

    assert.equal(resultA, false);
    assert.equal(resultB, true);
  });

  test("checkArrayType 테스트", () => {
    const testA = "[0, 1, 2, 3];";
    const testB = "{ a: 1, b: 2 };";

    const resultA = checkArrayType(testA);
    const resultB = checkArrayType(testB);

    assert.equal(resultA, true);
    assert.equal(resultB, false);
  });

  test("checkObjectType 테스트", () => {
    const testA = "[0, 1, 2, 3];";
    const testB = "{ a: 1, b: 2 };";

    const resultA = checkObjectType(testA);
    const resultB = checkObjectType(testB);

    assert.equal(resultA, false);
    assert.equal(resultB, true);
  });
});

suite("util 함수 테스트", () => {
  test("findValueInKeyFromStringTypeObject 테스트", () => {
    const obj = '{ a: 10, b: "tem", c: { d: true } }';
    const keys = ["a", "c", "d"];
    const values = findValueInKeyFromStringTypeObject(keys, obj);
    const a = values[0];
    const c = values[1];
    const d = values[2];

    assert.equal(a.includes("10"), true);
    assert.equal(c.includes("{ d: true }"), true);
    assert.equal(d.includes("true"), true);
  });
});
