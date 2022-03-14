const vscode = require("vscode");
const constants = require("./helper/constants");

const tokenTypes = new Map();
const tokenModifiers = new Map();

const legend = (function () {
  const tokenTypesLegend = [constants.TYPE];

  tokenTypesLegend.forEach((tokenType, index) =>
    tokenTypes.set(tokenType, index)
  );

  const tokenModifiersLegend = [
    constants.DECLARATION,
    constants.BOOLEAN,
    constants.STRING,
    constants.NUMBER,
    constants.NULL,
    constants.UNDEFINED,
    constants.ARRAY,
    constants.OBJECT,
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
