// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const espree = require('espree');
const { basename } = require('path');
const { readFileSync, writeFileSync, mkdirSync, rmSync} = require('fs');

async function getArcGISVersion() {
  const findResults = await vscode.workspace.findFiles('**/node_modules/@arcgis/core/package.json', '**/.pnpm/**');
  if (!findResults || findResults.length === 0) {
    vscode.window.showErrorMessage('Could not find @arcgis/core package.json');
    return;
  }
  const contents = readFileSync(findResults[0].fsPath, 'utf8');
  const packageJson = JSON.parse(contents);

  return packageJson.version;
}

let cacheDirectoryUri; // set in activate
function getCacheUri(version) {
  return vscode.Uri.joinPath(cacheDirectoryUri, `${version}.json`);
}

function getCachedItems(version) {
  const fileUri = getCacheUri(version);

  let contents;
  try {
    contents = readFileSync(fileUri.fsPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }

  return JSON.parse(contents);
}

function setCachedItems(version, items) {
  const filePath = getCacheUri(version);

  writeFileSync(filePath.fsPath, JSON.stringify(items));
}

function crawl() {
  const items = [];
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
          progress.report({
            increment: reportIncrement,
            message: `Crawling @arcgis/core...${numProcessed}/${URIs.length}`,
          });
          lastIncrement += reportIncrement;
        }

        // the native nodejs fs module was significantly faster than the vscode fs module
        const fileContents = readFileSync(uri.fsPath, 'utf8');

        let ast;
        try {
          ast = espree.parse(fileContents, { sourceType: 'module', ecmaVersion: 'latest' });
        } catch (error) {
          console.warn(`Error parsing ${uri.fsPath}: ${error.message}`);
          continue;
        }

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

      return items;
    });
  });
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "vscode-arcgis-js-api-module-butler" is now active!');

  cacheDirectoryUri = context.globalStorageUri, '/cache';

  // ensure that cache directory exists
  mkdirSync(cacheDirectoryUri.fsPath, { recursive: true });

  let addImport = vscode.commands.registerCommand('vscode-arcgis-js-api-module-butler.addImport', async function () {
    // get esri api version number
    const version = await getArcGISVersion();

    // check for cached list of modules
    let items = getCachedItems(version);

    // if not cached, crawl
    if (!items) {
      items = await crawl();
    }

    const quickPick = vscode.window.createQuickPick({canPickMany: false});
    quickPick.items = items;
    quickPick.matchOnDetail = true;
    quickPick.onDidChangeSelection(selection => {
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

    setCachedItems(version, items);
  });
  context.subscriptions.push(addImport);

  let clearCache = vscode.commands.registerCommand('vscode-arcgis-js-api-module-butler.clearCache', function () {
    rmSync(cacheDirectoryUri.fsPath, { recursive: true });
    mkdirSync(cacheDirectoryUri.fsPath);

    vscode.window.showInformationMessage('Cache cleared');
  });

  context.subscriptions.push(clearCache);
}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
