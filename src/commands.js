const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const Minifier = require("./minifier");
const { getFiles, normalizeIgnorePath } = require("./fileUtils");

function registerCommands(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.minifyFiles", minifyFilesCommand),
    vscode.commands.registerCommand("extension.obfuscateCurrentJSFile", obfuscateCurrentJSFileCommand),
    vscode.commands.registerCommand("extension.obfuscateAllJSInWorkspace", obfuscateAllJSInWorkspaceCommand),
    vscode.commands.registerCommand("extension.minifySelected", minifySelectedCommand)
  );
}

const CUSTOM_IGNORE_KEY = 'minifier.minifierCustomIgnoreList';

async function minifyFilesCommand() {
  const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : (await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select Folder"
  }))[0];

  if (!workspaceFolder) return;

  // Retrieve the previous custom ignore list
  const config = vscode.workspace.getConfiguration();
  const previousIgnoreList = config.get(CUSTOM_IGNORE_KEY, []);

  const options = await vscode.window.showQuickPick([
    { label: "Ignore files starting by . (dot)?", value: "dot" },
    { label: 'Ignore files ending in "min.css" and "min.js"?', value: "min", picked: true },
    { label: "Ignore any other file or folder?", value: "other" },
    ...(previousIgnoreList.length > 0 ? [
      { label: "Use previous custom ignore list", value: "previous" },
      { label: "Edit custom ignore list", value: "edit" }
    ] : [])
  ], {
    canPickMany: true,
    placeHolder: "Select options to ignore (use checkboxes)"
  });

  const ignoreDotFiles = options ? options.some(option => option.value === "dot") : false;
  const ignoreOther = options ? options.some(option => option.value === "other") : false;
  const ignoreMinFiles = options ? options.some(option => option.value === "min") : false;
  const usePreviousIgnoreList = options ? options.some(option => option.value === "previous") : false;
  const editIgnoreList = options ? options.some(option => option.value === "edit") : false;

  let ignoreList = [];

  if (editIgnoreList) {
    await openSettingsAtIgnoreList();
    return;
  } else if (usePreviousIgnoreList) {
    ignoreList = previousIgnoreList;
  } else if (ignoreOther) {
    const input = await vscode.window.showInputBox({
      prompt: "Enter the file or folder names, extensions, or paths to ignore, separated by commas (e.g., .json, .txt, src/components)"
    });

    if (input) {
      ignoreList = input.split(",").map(item => normalizeIgnorePath(item.trim())).filter(item => item);
      // Save the new ignore list
      await config.update(CUSTOM_IGNORE_KEY, ignoreList, vscode.ConfigurationTarget.Global);
    }
  }

  const rootPath = workspaceFolder.fsPath;
  const outputPath = path.join(rootPath, ".minifiedCodes.chatgpt");
  const files = getFiles(rootPath, rootPath, ignoreList, ignoreDotFiles, ignoreMinFiles);
  const minifier = new Minifier(files, outputPath);

  try {
    await minifier.minifyFiles();
    if (fs.existsSync(outputPath)) {
      try {
        const document = await vscode.workspace.openTextDocument(outputPath);
        await vscode.window.showTextDocument(document, vscode.ViewColumn.Active);
        vscode.window.showInformationMessage(`Minification completed. Output file: ${outputPath}`);
      } catch (openError) {
        vscode.window.showWarningMessage(`Minification completed, but couldn't open the output file. It's located at: ${outputPath}`);
      }
    } else {
      vscode.window.showWarningMessage(`Minification process completed, but the output file was not found at ${outputPath}`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`An error occurred during minification: ${error.message}`);
    return;
  }

  const obfuscationOption = await vscode.window.showQuickPick([
    { label: "Obfuscate current JS file", value: "current" },
    { label: "Obfuscate all JS in the workspace", value: "all" },
  ],
  { placeHolder: "Select an obfuscation option" });

  const jsFiles = files.filter((file) => file.extension === "js");

  if (obfuscationOption && obfuscationOption.value) {
    if (obfuscationOption.value === "current") {
      const activeTextEditor = vscode.window.activeTextEditor;
      if (activeTextEditor) {
        const activeDocument = activeTextEditor.document;
        const activeFile = jsFiles.find((file) => file.path === path.relative(rootPath, activeDocument.uri.fsPath));
        if (activeFile) {
          try {
            await minifier.obfuscateJsFiles([activeFile]);
            vscode.window.showInformationMessage(`Current JS file obfuscated successfully.`);
          } catch (obfuscateError) {
            vscode.window.showErrorMessage(`Error obfuscating current JS file: ${obfuscateError.message}`);
          }
        } else {
          vscode.window.showWarningMessage(`Current file is not a JavaScript file or was not included in the minification process.`);
        }
      } else {
        vscode.window.showWarningMessage(`No active text editor found.`);
      }
    } else if (obfuscationOption.value === "all") {
      try {
        await minifier.obfuscateJsFiles(jsFiles);
        vscode.window.showInformationMessage(`All JS files in the workspace obfuscated successfully.`);
      } catch (obfuscateError) {
        vscode.window.showErrorMessage(`Error obfuscating JS files: ${obfuscateError.message}`);
      }
    }
  }
}

async function openSettingsAtIgnoreList() {
  const settingsUri = vscode.Uri.parse('vscode://defaultsettings/settings.json');
  const document = await vscode.workspace.openTextDocument(settingsUri);
  const editor = await vscode.window.showTextDocument(document);

  const text = editor.document.getText();
  const searchString = '"minifier.minifierCustomIgnoreList":';
  const index = text.indexOf(searchString);

  if (index !== -1) {
    const position = editor.document.positionAt(index);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
  }

  vscode.commands.executeCommand('workbench.action.openSettingsJson');
}

async function obfuscateCurrentJSFileCommand() {
  const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : (await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select Folder"
  }))[0];

  if (!workspaceFolder) return;

  const rootPath = workspaceFolder.fsPath;
  const outputPath = path.join(rootPath, ".minifiedCodes.chatgpt");
  const files = getFiles(rootPath, rootPath, [], false, false);
  const minifier = new Minifier(files, outputPath);

  const activeTextEditor = vscode.window.activeTextEditor;
  if (activeTextEditor) {
    const activeDocument = activeTextEditor.document;
    const activeFile = files.find((file) => file.path === path.relative(rootPath, activeDocument.uri.fsPath) && file.extension === "js");
    if (activeFile) {
      await minifier.obfuscateJsFiles([activeFile]);
    }
  }
}

async function obfuscateAllJSInWorkspaceCommand() {
  const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : (await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select Folder"
  }))[0];

  if (!workspaceFolder) return;

  const rootPath = workspaceFolder.fsPath;
  const outputPath = path.join(rootPath, ".minifiedCodes.chatgpt");
  const files = getFiles(rootPath, rootPath, [], false, false);
  const minifier = new Minifier(files, outputPath);

  const jsFiles = files.filter((file) => file.extension === "js");
  await minifier.obfuscateJsFiles(jsFiles);
}

async function minifySelectedCommand(uri, uris) {
  let selectedUris = uris;
  if (!selectedUris) {
    selectedUris = uri ? [uri] : [];
  }

  if (selectedUris.length === 0) {
    vscode.window.showErrorMessage("No files or folders selected.");
    return;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(selectedUris[0]);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("Unable to determine workspace folder.");
    return;
  }

  const rootPath = workspaceFolder.uri.fsPath;
  const outputPath = path.join(rootPath, ".minifiedCodes.chatgpt");

  const allFiles = [];
  for (const selectedUri of selectedUris) {
    const selectedPath = selectedUri.fsPath;
    if (fs.statSync(selectedPath).isDirectory()) {
      allFiles.push(...getFiles(rootPath, selectedPath, [], false, false));
    } else {
      const relativePath = path.relative(rootPath, selectedPath);
      let extension = path.extname(selectedPath).substring(1);
      if (path.basename(selectedPath).endsWith('.blade.php')) {
        extension = 'blade.php';
      }
      allFiles.push({
        path: relativePath,
        name: path.basename(selectedPath),
        extension: extension,
        modifiedTime: fs.statSync(selectedPath).mtime
      });
    }
  }

  const minifier = new Minifier(allFiles, outputPath);
  await minifier.minifyFiles();

  const document = await vscode.workspace.openTextDocument(outputPath);
  await vscode.window.showTextDocument(document, vscode.ViewColumn.Active);
  vscode.window.showInformationMessage(`Minified ${allFiles.length} files from ${selectedUris.length} selections.`);
}

module.exports = {
  registerCommands
};