const vscode = require("vscode");

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

exports.legend = legend;
exports.tokenTypes = tokenTypes;
exports.tokenModifiers = tokenModifiers;
