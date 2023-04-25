const fs = require("fs"),
  path = require("path"),
  vscode = require("vscode"),
  htmlMinifier = require("html-minifier").minify;

class Minifier {
  constructor(e, i) {
    this.files = e, this.outputFilePath = i, this.errors = []
  }

  shouldIgnoreFile(file, ignoredExtensions) {
    return ignoredExtensions.some(ext => file.endsWith(ext));
  }

  customMinify(content) {
    return content
      .split('\n')
      .map(line => line.trim())
      .join('');
  }
  async minifyFiles() {
    if (fs.existsSync(this.outputFilePath) && fs.unlinkSync(this.outputFilePath), await Promise.all(this.files.map(async e => {
        if ("package-lock" === e.name || this.shouldIgnoreFile(e.name, ['.png', '.jpg', '.sample', '.lock', '.md', '.babelrc'])) return;
        const i = path.join(this.outputFilePath, "..", e.path),
          t = fs.readFileSync(i).toString();
        let s;
        try {
          switch (e.extension) {
            case "scss":
            case "tsx":
            case "ts":
            case "json":
            case "js":
            case "css":
              s = this.customMinify(t);
              break;
            case "html":
              s = htmlMinifier(t, { removeComments: true, collapseWhitespace: true });
              break;

            default:
              throw new Error("Unsupported file format")
          }
          const n = `<"file: ${e.path}">`,
            o = `</"file: ${e.path}">`;
          fs.appendFileSync(this.outputFilePath, `${n}${s}${o}${n.includes("file: ")?"\n\n":""}`)
        } catch (i) {
          const t = `Error minifying ${e.path}: ${i.message}`;
          this.errors.push(t)
        }
      })), this.errors.length > 0) {
      const e = this.errors.join("\n"),
        i = `<"file: error.txt">${e}</"file: error.txt">\n\n`;
      fs.appendFileSync(this.outputFilePath, i);
      const t = "Fix the errors and re-run the minify command.",
        s = `<"file: instructions.txt">${t}</"file: instructions.txt">\n\n`;
      fs.appendFileSync(this.outputFilePath, s)
    }
  }
}

function getFiles(baseDir, currentDir, ignoredItems, ignoreDot, ignoreMin) {
  const files = [];
  const items = fs.readdirSync(currentDir);

  // Add package-lock.json and dist to the ignoredItems list
  ignoredItems.push('package-lock.json', 'dist');

  items.forEach(item => {
    const fullPath = path.join(currentDir, item);
    const relPath = path.relative(baseDir, fullPath);

    if (ignoredItems.includes(item) || ignoredItems.includes(relPath)) {
      return;
    }

    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      if (item === "node_modules" || item === ".git") return; // Ignore node_modules and .git folder
      files.push(...getFiles(baseDir, fullPath, ignoredItems, ignoreDot, ignoreMin));
    } else if (stats.isFile()) {
      const ext = path.extname(item).substring(1);

      if ((ignoreDot && item.startsWith(".")) || (ignoreMin && ["min.js", "min.css"].includes(item))) {
        return;
      }


      files.push({
        path: relPath,
        name: item,
        extension: ext
      });
    }
  });

  return files;
}

const minifyCommand = vscode.commands.registerCommand("extension.minifyFiles", async () => {
  const e = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : (await vscode.window.showOpenDialog({
    canSelectFiles: !1,
    canSelectFolders: !0,
    canSelectMany: !1,
    openLabel: "Select Folder"
  }))[0];
  if (!e) return;
  const i = await vscode.window.showQuickPick([{
      label: "Ignore files starting by . (dot)?",
      value: "dot"
    },
    {
      label: 'Ignore files ending in "min.css" and "min.js"?',
      value: "min",
      picked: true
    },
    {
      label: "Ignore any other file or folder?",
      value: "other"
    }
  ], {
    canPickMany: !0,
    placeHolder: "Select options to ignore (use checkboxes)"
  }),
    t = i.some(e => "dot" === e.value),
    s = i.some(e => "other" === e.value),
    n = i.some(e => "min" === e.value);
  let o = [];
  if (s) {
    const e = await vscode.window.showInputBox({
      prompt: "Enter the file or folder names to ignore, separated by commas"
    });
    e && (o = e.split(",").map(e => e.trim()))
  }
  const r = e.fsPath,
    a = path.join(r, ".minifiedCodes.chatgpt"),
    c = getFiles(r, r, o, t, n),
    l = new Minifier(c, a);
  l.minifyFiles();
  const h = await vscode.workspace.openTextDocument(a);
  await vscode.window.showTextDocument(h, vscode.ViewColumn.Active)
});

exports.minifyCommand = minifyCommand;

