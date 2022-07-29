// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const espree = require('espree');
const { readFileSync, stat } = require('fs');
const { basename } = require('path');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "vscode-arcgis-js-api-module-butler" is now active!');

  const commandId = 'vscode-arcgis-js-api-module-butler.addImport';

  vscode.window.showInformationMessage('The extension "vscode-arcgis-js-api-module-butler" is now active!');

  let items = [];
  function crawl() {
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'ArcGIS JS API Module Butler',
    }, async (progress, token) => {
      // crawl @arcgis/core and build a list of all of the modules and their exports
      return vscode.workspace.findFiles('**/@arcgis/core/**/*.js', null).then(async URIs => {
        console.log('parsing files')
        let numProcessed = 0;
        let lastIncrement = 0;
        const reportIncrement = 1;
        for (let uri of URIs) {
          numProcessed++;
          const increment = (numProcessed / URIs.length) * 100;
          if (increment >= lastIncrement + reportIncrement) {
            // prevent blocking of the UI (ref: https://github.com/microsoft/vscode/issues/139855)
            await new Promise(resolve => setTimeout(resolve, 0));
            console.log(increment)
            progress.report({
              increment: reportIncrement,
              message: `Crawling @arcgis/core...${numProcessed}/${URIs.length}`,
            });
            lastIncrement += reportIncrement;
          }

          const fileContents = readFileSync(uri.fsPath, 'utf8');
          const ast = espree.parse(fileContents, { sourceType: 'module', ecmaVersion: 2020 });

          for (let node of ast.body) {
            if (token.isCancellationRequested) {
              break;
            }

            if (node.type === 'ExportNamedDeclaration') {
              for (let specifier of node.specifiers) {
                let exportName = specifier.exported.name;
                const importPath = uri.path.split('/node_modules/')[1].replace('.js', '');
                if (exportName === 'default') {
                  exportName = basename(uri.path).replace('.js', '');
                  items.push({
                    label: exportName,
                    detail: importPath,
                    importString: `import ${exportName} from '${importPath}';`
                  });
                } else {
                  items.push({
                    label: exportName,
                    detail: importPath,
                    importString: `import { ${exportName} } from '${importPath}';`
                  })
                }
              }
            } else if (node.type.startsWith('Export')) {
              console.log(node.type);
            }
          }
        }

        console.log('parsing complete');
      });
    });
  }

  let disposable = vscode.commands.registerCommand(commandId, async function () {
    if (items.length === 0) {
      await crawl();
    }

    const quickPick = vscode.window.createQuickPick({canPickMany: false});
    quickPick.items = items;
    quickPick.matchOnDetail = true;
    quickPick.onDidChangeSelection(selection => {
      console.log(selection[0].importString);
      quickPick.hide();
      vscode.window.activeTextEditor.edit(editBuilder => {
        // find first blank line
        const document = vscode.window.activeTextEditor.document;
        for (let i = 0; i < document.lineCount; i++) {
          const line = document.lineAt(i);
          if (line.isEmptyOrWhitespace) {
            editBuilder.insert(line.range.start, `${selection[0].importString} \n`);
            return;
          }
        }
      })
    });
    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
