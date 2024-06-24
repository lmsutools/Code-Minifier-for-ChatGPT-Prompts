const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const htmlMinifier = require("html-minifier").minify;
const JavaScriptObfuscator = require("javascript-obfuscator");

class Minifier {
    constructor(files, outputFilePath) {
        this.files = files;
        this.outputFilePath = outputFilePath;
        this.errors = [];
    }

    async obfuscateJsFiles(filesToObfuscate) {
        const obfuscationResults = [];
        for (const file of filesToObfuscate) {
            const filePath = path.join(this.outputFilePath, "..", file.path);
            try {
                const fileContent = fs.readFileSync(filePath, "utf-8");
                const obfuscatedCode = JavaScriptObfuscator.obfuscate(fileContent);
                fs.writeFileSync(filePath, obfuscatedCode.getObfuscatedCode());
                obfuscationResults.push(`<"file: ${file.path}">Successfully obfuscated</"file: ${file.path}">`);
            } catch (error) {
                obfuscationResults.push(`<"file: ${file.path}">Couldn't be obfuscated: ${error.message}</"file: ${file.path}">`);
            }
        }
        fs.writeFileSync(path.join(this.outputFilePath, "..", "obfuscated.txt"), obfuscationResults.join("\n"));
    }

    shouldIgnoreFile(fileName, ignoreList) {
        return ignoreList.some((ignoreItem) => fileName.endsWith(ignoreItem));
    }

    customMinify(content) {
        return content.split("\n").map((line) => line.trim()).join("");
    }

    minifyXAML(content) {
        return content.replace(/\s*\n\s*/g, "").replace(/\s*\>\s*/g, ">").replace(/\s*\</g, "<").replace(/\s+/g, " ");
    }

    minifyCSharpCode(content) {
        return content.replace(/\/\/.*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n/g, "").replace(/\s+/g, " ").replace(/\s*([;,:{}()])\s*/g, "$1");
    }

    async minifyFiles() {
        this.files.sort((a, b) => b.modifiedTime - a.modifiedTime);

        if (fs.existsSync(this.outputFilePath)) {
            fs.unlinkSync(this.outputFilePath);
        }

        await Promise.all(this.files.map(async (file) => {
            if (this.shouldIgnoreFile(file.name, ["package-lock.json", "dist", "obj", "bin", ".vscode", ".png", ".jpg", ".sample", ".lock", ".md", ".babelrc", ".vsix", ".vscodeignore"])) {
                return;
            }

            const filePath = path.join(this.outputFilePath, "..", file.path);
            const fileContent = fs.readFileSync(filePath).toString();

            let minifiedContent;

            try {
                switch (file.extension) {
                    case "scss":
                    case "tsx":
                    case "ts":
                    case "json":
                    case "js":
                    case "css":
                        minifiedContent = this.customMinify(fileContent);
                        break;

                    case "py":
                        minifiedContent = fileContent; // No minification for Python files
                        break;
                                          
                    case "html":
                    case "ejs":
                    case "pug":
                        minifiedContent = htmlMinifier(fileContent, { removeComments: true, collapseWhitespace: true });
                        break;
                    case "xaml":
                    case "csproj":
                        minifiedContent = this.minifyXAML(fileContent);
                        break;
                    case "cs":
                        minifiedContent = this.minifyCSharpCode(fileContent);
                        break;
                    default:
                        throw new Error("Unsupported file format");
                }

                const openTag = `<"file: ${file.path}">`;
                const closeTag = `</"file: ${file.path}">`;

                fs.appendFileSync(this.outputFilePath, `${openTag}${minifiedContent}${closeTag}\n\n`);
            } catch (error) {
                const errorMessage = `Error minifying ${file.path}: ${error.message}`;
                this.errors.push(errorMessage);
            }
        }));

        if (this.errors.length > 0) {
            const errorsText = this.errors.join("\n");
            fs.appendFileSync(this.outputFilePath, `<"file: error.txt">${errorsText}</"file: error.txt">\n\n`);
        }
    }
}

function getFiles(rootPath, currentPath, ignoreList, ignoreDotFiles, ignoreMinFiles) {
  const files = [];
  const directoryItems = fs.readdirSync(currentPath);
  ignoreList = ignoreList.concat(["package-lock.json", "dist", "obj", "bin", ".vscode"]);

  for (const itemName of directoryItems) {
      const itemPath = path.join(currentPath, itemName);
      const relativePath = path.relative(rootPath, itemPath);
      const itemExtension = path.extname(itemName);

      if (ignoreList.includes(itemName) || ignoreList.includes(relativePath) || ignoreList.includes(itemExtension)) {
          continue;
      }

      const itemStat = fs.statSync(itemPath);

      if (itemStat.isDirectory()) {
          if (itemName.startsWith("env_") || itemName === "node_modules" || itemName === ".git") {
              continue;
          }
          files.push(...getFiles(rootPath, itemPath, ignoreList, ignoreDotFiles, ignoreMinFiles));
      } else if (itemStat.isFile()) {
          if ((ignoreDotFiles && itemName.startsWith(".")) || (ignoreMinFiles && (itemExtension === ".min.js" || itemExtension === ".min.css"))) {
              continue;
          }
          files.push({ path: relativePath, name: itemName, extension: itemExtension.substring(1), modifiedTime: itemStat.mtime });
      }
  }
  return files;
}

const minifyCommand = vscode.commands.registerCommand("extension.minifyFiles", async () => {
  const e = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : (await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select Folder"
  }))[0];
  if (!e) return;
  const i = await vscode.window.showQuickPick([
    { label: "Ignore files starting by . (dot)?", value: "dot" },
    { label: 'Ignore files ending in "min.css" and "min.js"?', value: "min", picked: true },
    { label: "Ignore any other file or folder?", value: "other" }
  ], {
    canPickMany: true,
    placeHolder: "Select options to ignore (use checkboxes)"
  });
  const t = i ? i.some(e => "dot" === e.value) : false,
        s = i ? i.some(e => "other" === e.value) : false,
        n = i ? i.some(e => "min" === e.value) : false;
  let o = [];
  if (s) {
    const e = await vscode.window.showInputBox({
      prompt: "Enter the file or folder names or extensions to ignore, separated by commas (e.g., .json, .txt)"
    });
    if (e) {
      o = e.split(",").map(e => e.trim()).filter(e => e);
    }
  }
  const r = e.fsPath,
        a = path.join(r, ".minifiedCodes.chatgpt"),
        c = getFiles(r, r, o, t, n),
        l = new Minifier(c, a);
  await l.minifyFiles();
  const h = await vscode.workspace.openTextDocument(a);
  await vscode.window.showTextDocument(h, vscode.ViewColumn.Active);

  const obfuscationOption = await vscode.window.showQuickPick(
    [
      { label: "Obfuscate current JS file", value: "current" },
      { label: "Obfuscate all JS in the workspace", value: "all" },
    ],
    { placeHolder: "Select an obfuscation option" }
  );

  const jsFiles = c.filter((file) => file.extension === "js");

  if (obfuscationOption && obfuscationOption.value) {
    if (obfuscationOption.value === "current") {
      const activeTextEditor = vscode.window.activeTextEditor;
      if (activeTextEditor) {
        const activeDocument = activeTextEditor.document;
        const activeFile = jsFiles.find((file) => file.path === path.relative(r, activeDocument.uri.fsPath));
        if (activeFile) {
          await l.obfuscateJsFiles([activeFile]);
        }
      }
    } else if (obfuscationOption.value === "all") {
      await l.obfuscateJsFiles(jsFiles);
    }
  }
});

const obfuscateCurrentJSFile = vscode.commands.registerCommand("extension.obfuscateCurrentJSFile", async () => {
  const e = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : (await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select Folder"
  }))[0];
  if (!e) return;

  const r = e.fsPath,
        a = path.join(r, ".minifiedCodes.chatgpt"),
        c = getFiles(r, r, [], false, false),
        l = new Minifier(c, a);

  const activeTextEditor = vscode.window.activeTextEditor;
  if (activeTextEditor) {
    const activeDocument = activeTextEditor.document;
    const activeFile = c.find((file) => file.path === path.relative(r, activeDocument.uri.fsPath) && file.extension === "js");
    if (activeFile) {
      await l.obfuscateJsFiles([activeFile]);
    }
  }
});

const obfuscateAllJSInWorkspace = vscode.commands.registerCommand("extension.obfuscateAllJSInWorkspace", async () => {
  const e = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : (await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select Folder"
  }))[0];
  if (!e) return;

  const r = e.fsPath,
        a = path.join(r, ".minifiedCodes.chatgpt"),
        c = getFiles(r, r, [], false, false),
        l = new Minifier(c, a);

  const jsFiles = c.filter((file) => file.extension === "js");
  await l.obfuscateJsFiles(jsFiles);
});

const minifySelectedCommand = vscode.commands.registerCommand("extension.minifySelected", async (uri, uris) => {
  let selectedUris = uris;
  
  // If no uris are provided (single selection), use the single uri
  if (!selectedUris) {
      selectedUris = uri ? [uri] : [];
  }

  // If still no uris, show an error
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
          const extension = path.extname(selectedPath).substring(1);
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
});

function activate(context) {
    context.subscriptions.push(minifyCommand);
    context.subscriptions.push(obfuscateCurrentJSFile);
    context.subscriptions.push(obfuscateAllJSInWorkspace);
    context.subscriptions.push(minifySelectedCommand);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};