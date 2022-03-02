const vscode = require("vscode");
const selector = require("./src/selector");
const Provider = require("./src/provider");
const { legend } = require("./src/legend");

/**
 * @param {vscode.ExtensionContext} context
 */

function activate(context) {
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      selector,
      Provider,
      legend
    )
  );
}

module.exports = {
  activate,
};
