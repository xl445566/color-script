const vscode = require("vscode");
const selector = require("./src/selector");
const provider = require("./src/provider");
const { legend } = require("./src/legend");

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

module.exports = {
  activate,
};
