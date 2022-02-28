const vscode = require("vscode");

/**
 * @param {vscode.ExtensionContext} context
 */

function activate(context) {
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      selector,
      provider,
      legend
    )
  );
}

function createProvider() {
  let isCommenting = false;
  let currentOffset = 0;

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

  // TODO:  재할당
  function parseText(text) {
    const results = [];
    const lines = text.split(/\r\n|\r|\n/);

    for (let i = 0; i < lines.length; i++) {
      const isSkip = validateLine(lines[i]);
      if (isSkip || isCommenting) {
        continue;
      }

      currentOffset = 0;
      const convertedLine = removeComment(lines[i]).split("=");

      const declarationArea = convertedLine[0].split(" ");
      const definitionArea = convertedLine[1];

      const startPos = currentOffset + declarationArea[0].length + 1;
      const endPos = startPos + declarationArea[1].length;

      if (
        definitionArea.trim() === "true;" ||
        definitionArea.trim() === "true" ||
        definitionArea.trim() === "false;" ||
        definitionArea.trim() === "false"
      ) {
        const tokenData = parseToken("boolean");

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

  function validateLine(text) {
    if (!text) {
      return true;
    }

    if (text.trim().indexOf("//") === 0) {
      return true;
    }

    if (
      text.trim().indexOf("/*") === 0 &&
      text.trim().indexOf("*/") === text.trim().length - 2
    ) {
      return true;
    }

    if (text.trim().indexOf("/*") === 0 && !text.includes("*/")) {
      isCommenting = true;
      return true;
    }

    if (
      !text.includes("/*") &&
      text.includes("*/") &&
      !text.split("*/")[1].trim()
    ) {
      isCommenting = false;
      return true;
    }

    if (
      !text.includes("/*") &&
      text.includes("*/") &&
      text.split("*/")[1].trim()
    ) {
      isCommenting = false;
    }

    return false;
  }

  function removeComment(text) {
    const isSlashComment = text.split(";")[1];
    if (isSlashComment) {
      return text.split(";")[0] + ";";
    }

    const isBlockComment = text.includes("*/");
    if (isBlockComment) {
      currentOffset = text.indexOf(text.split("*/")[1].trimStart());
      return text.split("*/")[1].trimStart();
    }

    return text;
  }

  function parseToken(type) {
    switch (type) {
      case "boolean":
        return {
          tokenType: "type",
          tokenModifiers: ["declaration", "boolean"],
        };
      case "string":
        return {
          tokenType: "type",
          tokenModifiers: ["declaration", "string"],
        };
      case "number":
        return {
          tokenType: "type",
          tokenModifiers: ["declaration", "number"],
        };
      case "null":
        return {
          tokenType: "type",
          tokenModifiers: ["declaration", "null"],
        };
      case "undefined":
        return {
          tokenType: "type",
          tokenModifiers: ["declaration", "undefined"],
        };
      case "array":
        return {
          tokenType: "type",
          tokenModifiers: ["declaration", "array"],
        };
      case "object":
        return {
          tokenType: "type",
          tokenModifiers: ["declaration", "object"],
        };
    }

    return {
      tokenType: "",
      tokenModifiers: [""],
    };
  }

  return {
    provideDocumentSemanticTokens,
    encodeTokenModifiers,
    encodeTokenType,
    parseText,
    parseToken,
    removeComment,
    validateLine,
  };
}

const selector = { language: "javascript", scheme: "file" };
const provider = createProvider();
const tokenTypes = new Map();
const tokenModifiers = new Map();
const legend = (function () {
  const tokenTypesLegend = ["type"];

  tokenTypesLegend.forEach((tokenType, index) =>
    tokenTypes.set(tokenType, index)
  );

  const tokenModifiersLegend = [
    "declaration",
    "boolean",
    "string",
    "number",
    "null",
    "undefined",
    "array",
    "object",
  ];

  tokenModifiersLegend.forEach((tokenModifier, index) =>
    tokenModifiers.set(tokenModifier, index)
  );

  return new vscode.SemanticTokensLegend(
    tokenTypesLegend,
    tokenModifiersLegend
  );
})();

module.exports = {
  activate,
};
