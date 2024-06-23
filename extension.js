const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const htmlMinifier = require("html-minifier").minify;
const JavaScriptObfuscator = require("javascript-obfuscator");

const DEFAULT_IGNORE_LIST = [
    "package-lock.json",
    "dist",
    "node_modules",
    "obj",
    "bin",
    ".vscode",
    ".png",
    ".jpg",
    ".sample",
    ".lock",
    ".md",
    ".babelrc",
    ".vsix",
    ".vscodeignore"
];

class Minifier {
    constructor(files, outputFilePath, ignoreList) {
        this.files = files;
        this.outputFilePath = outputFilePath;
        this.errors = [];
        this.ignoreList = ignoreList;
    }

    async obfuscateJsFiles(filesToObfuscate) {
        const obfuscationResults = [];
        for (const file of filesToObfuscate) {
            const filePath = path.join(this.outputFilePath, "..", file.path);
            try {
                const fileContent = fs.readFileSync(filePath, "utf-8");
                const obfuscatedCode = JavaScriptObfuscator.obfuscate(fileContent);
                fs.writeFileSync(filePath, obfuscatedCode.getObfuscatedCode());
                obfuscationResults.push(`file: ${file.path} Successfully obfuscated`);
            } catch (error) {
                obfuscationResults.push(`file: ${file.path} Couldn't be obfuscated: ${error.message}`);
            }
        }
        fs.writeFileSync(path.join(this.outputFilePath, "..", "obfuscated.txt"), obfuscationResults.join("\n"));
    }

    shouldIgnoreFile(fileName, ignoreList) {
        return ignoreList && ignoreList.some((ignoreItem) => fileName.endsWith(ignoreItem));
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

        let outputContent = '';

        await Promise.all(this.files.map(async (file) => {
            if (this.shouldIgnoreFile(file.name, this.ignoreList)) {
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
                    case "vue":
                        minifiedContent = this.minifyVueFile(fileContent);
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

                outputContent += `${openTag}${minifiedContent}${closeTag}\n\n`;
            } catch (error) {
                const errorMessage = `Error minifying ${file.path}: ${error.message}`;
                this.errors.push(errorMessage);
            }
        }));

        if (this.errors.length > 0) {
            const errorsText = this.errors.join("\n");
            outputContent += `<"file: error.txt">${errorsText}</"file: error.txt">\n\n`;
        }

        fs.writeFileSync(this.outputFilePath, outputContent);
    }

    minifyVueFile(content) {
        const script = content.match(/<script.*?>([\s\S]*?)<\/script>/);
        const style = content.match(/<style.*?>([\s\S]*?)<\/style>/);
        const template = content.match(/<template.*?>([\s\S]*?)<\/template>/);

        let minifiedContent = '';

        if (template) {
            const minifiedTemplate = htmlMinifier(template[0], { removeComments: true, collapseWhitespace: true });
            minifiedContent += minifiedTemplate;
        }

        if (script) {
            const minifiedScript = this.customMinify(script[0]);
            minifiedContent += minifiedScript;
        }

        if (style) {
            const minifiedStyle = this.customMinify(style[0]);
            minifiedContent += minifiedStyle;
        }

        return minifiedContent;
    }
}

function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

function getFiles(rootPath, currentPath, userIgnoreList, ignoreDotFiles, ignoreMinFiles) {
    const files = [];
    const directoryItems = fs.readdirSync(currentPath);
    const combinedIgnoreList = [...DEFAULT_IGNORE_LIST, ...userIgnoreList];

    for (const itemName of directoryItems) {
        const itemPath = path.join(currentPath, itemName);
        const relativePath = path.relative(rootPath, itemPath);
        const itemExtension = path.extname(itemName);

        if (combinedIgnoreList.includes(itemName) || combinedIgnoreList.includes(relativePath) || combinedIgnoreList.includes(itemExtension)) {
            continue;
        }

        const itemStat = fs.statSync(itemPath);

        if (itemStat.isDirectory()) {
            if (itemName.startsWith("env_") || itemName === "node_modules" || itemName === ".git") {
                continue;
            }
            files.push(...getFiles(rootPath, itemPath, userIgnoreList, ignoreDotFiles, ignoreMinFiles));
        } else if (itemStat.isFile()) {
            if ((ignoreDotFiles && itemName.startsWith(".")) || (ignoreMinFiles && (itemExtension === ".min.js" || itemExtension === ".min.css"))) {
                continue;
            }
            files.push({ path: relativePath, name: itemName, extension: itemExtension.substring(1), modifiedTime: itemStat.mtime });
        }
    }
    return files;
}

function loadIgnoreOptions() {
    const configPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'userSettings.json');
    if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(configContent).ignoreOptions || [];
    }
    return [];
}

function saveIgnoreOptions(options) {
    const configPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'userSettings.json');
    let configContent = {};
    if (fs.existsSync(configPath)) {
        configContent = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    configContent.ignoreOptions = options;
    fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
}

const minifyCommand = vscode.commands.registerCommand("extension.minifyFiles", async () => {
    const folderUri = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : (await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Folder"
    }))[0];
    if (!folderUri) return;

    const savedIgnoreOptions = loadIgnoreOptions();
    const quickPickOptions = [
        { label: "Ignore files starting by . (dot)?", value: "dot" },
        { label: 'Ignore files ending in "min.css" and "min.js"?', value: "min", picked: true },
        { label: "Ignore any other file or folder?", value: "other" },
        ...savedIgnoreOptions.map(option => ({ label: `Ignore ${option}`, value: option }))
    ];

    const selectedOptions = await vscode.window.showQuickPick(quickPickOptions, {
        canPickMany: true,
        placeHolder: "Select options to ignore (use checkboxes)"
    });

    const ignoreDotFiles = selectedOptions.some(option => option.value === "dot");
    const ignoreMinFiles = selectedOptions.some(option => option.value === "min");
    let customIgnoreOptions = selectedOptions.filter(option => option.value !== "dot" && option.value !== "min" && option.value !== "other").map(option => option.value);

    if (selectedOptions.some(option => option.value === "other")) {
        const userInput = await vscode.window.showInputBox({
            prompt: "Enter the file or folder names or extensions to ignore, separated by commas (e.g., .json, .txt)"
        });
        if (userInput) {
            customIgnoreOptions = customIgnoreOptions.concat(userInput.split(",").map(item => item.trim()).filter(item => item));
        }
    }

    saveIgnoreOptions(customIgnoreOptions);

    const rootPath = folderUri.fsPath;
    const outputFilePath = path.join(rootPath, ".minifiedCodes.chatgpt");
    ensureDirectoryExistence(outputFilePath);

    // Close the file if it's already open
    const openedDocument = vscode.workspace.textDocuments.find(doc => doc.fileName === outputFilePath);
    if (openedDocument) {
        await vscode.window.showTextDocument(openedDocument, { preview: false, viewColumn: vscode.ViewColumn.Active });
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }

    // Delete the file if it exists
    if (fs.existsSync(outputFilePath)) {
        fs.unlinkSync(outputFilePath);
    }

    const files = getFiles(rootPath, rootPath, customIgnoreOptions, ignoreDotFiles, ignoreMinFiles);
    const minifier = new Minifier(files, outputFilePath, customIgnoreOptions);

    await minifier.minifyFiles();
    const document = await vscode.workspace.openTextDocument(outputFilePath);
    await vscode.window.showTextDocument(document, vscode.ViewColumn.Active);

    const obfuscationOption = await vscode.window.showQuickPick(
        [
            { label: "Obfuscate current JS file", value: "current" },
            { label: "Obfuscate all JS in the workspace", value: "all" }
        ],
        { placeHolder: "Select an obfuscation option" }
    );

    if (obfuscationOption && obfuscationOption.value) {
        const jsFiles = files.filter(file => file.extension === "js");

        if (obfuscationOption.value === "current") {
            const activeTextEditor = vscode.window.activeTextEditor;
            if (activeTextEditor) {
                const activeDocument = activeTextEditor.document;
                const activeFile = jsFiles.find(file => file.path === path.relative(rootPath, activeDocument.uri.fsPath));
                if (activeFile) {
                    await minifier.obfuscateJsFiles([activeFile]);
                }
            }
        } else if (obfuscationOption.value === "all") {
            await minifier.obfuscateJsFiles(jsFiles);
        }
    }
});

const obfuscateCurrentJSFile = vscode.commands.registerCommand("extension.obfuscateCurrentJSFile", async () => {
    const folderUri = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : (await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Folder"
    }))[0];
    if (!folderUri) return;

    const rootPath = folderUri.fsPath;
    const outputFilePath = path.join(rootPath, ".minifiedCodes.chatgpt");
    ensureDirectoryExistence(outputFilePath);
    const files = getFiles(rootPath, rootPath, [], false, false);
    const minifier = new Minifier(files, outputFilePath, []);

    const activeTextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor) {
        const activeDocument = activeTextEditor.document;
        const activeFile = files.find(file => file.path === path.relative(rootPath, activeDocument.uri.fsPath) && file.extension === "js");
        if (activeFile) {
            await minifier.obfuscateJsFiles([activeFile]);
        }
    }
});

const obfuscateAllJSInWorkspace = vscode.commands.registerCommand("extension.obfuscateAllJSInWorkspace", async () => {
    const folderUri = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : (await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Folder"
    }))[0];
    if (!folderUri) return;

    const rootPath = folderUri.fsPath;
    const outputFilePath = path.join(rootPath, ".minifiedCodes.chatgpt");
    ensureDirectoryExistence(outputFilePath);
    const files = getFiles(rootPath, rootPath, [], false, false);
    const minifier = new Minifier(files, outputFilePath, []);

    const jsFiles = files.filter(file => file.extension === "js");
    await minifier.obfuscateJsFiles(jsFiles);
});

exports.minifyCommand = minifyCommand;
exports.obfuscateCurrentJSFile = obfuscateCurrentJSFile;
exports.obfuscateAllJSInWorkspace = obfuscateAllJSInWorkspace;