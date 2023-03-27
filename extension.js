function getFiles(e, i, t = [], s = !1, n = !1) {
  let o = [];
  const r = fs.readdirSync(e);
  return r.forEach(r => {
    if (t.includes(r) || s && r.startsWith(".") || /node_modules/.test(path.join(e, r)) || ".git" === r || ".gitignore" === r || "_minifiedCodes.chatgpt" === r) return;
    if (n && (/\.min\.js$/.test(r) || /\.min\.css$/.test(r))) return;
    const a = path.join(e, r),
      c = fs.statSync(a);
    c.isDirectory() && ![".vscode"].includes(r) ? o = [...o, ...getFiles(a, i, t, s, n)] : c.isFile() && o.push({
      name: path.basename(r, path.extname(r)),
      path: path.relative(i, a),
      extension: path.extname(r).substring(1)
    })
  }), o
}
const fs = require("fs"),
  path = require("path"),
  vscode = require("vscode"),
  uglifyJS = require("uglify-js"),
  cleanCSS = require("clean-css"),
  htmlMinifier = require("html-minifier").minify;
class Minifier {
  constructor(e, i) {
    this.files = e, this.outputFilePath = i, this.errors = []
  }
  minifyFiles() {
    if (fs.existsSync(this.outputFilePath) && fs.unlinkSync(this.outputFilePath), this.files.forEach(e => {
        if ("package-lock" === e.name) return;
        const i = path.join(this.outputFilePath, "..", e.path),
          t = fs.readFileSync(i).toString();
        let s;
        try {
          switch (e.extension) {
            case "js":
              s = uglifyJS.minify(t).code;
              break;
            case "css":
              s = new cleanCSS({}).minify(t).styles;
              break;
            case "html":
              s = htmlMinifier(t, {
                removeComments: !0,
                collapseWhitespace: !0
              });
              break;
            case "json":
              s = JSON.stringify(JSON.parse(t));
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
      }), this.errors.length > 0) {
      const e = this.errors.join("\n"),
        i = `<"file: error.txt">${e}</"file: error.txt">\n\n`;
      fs.appendFileSync(this.outputFilePath, i);
      const t = "Fix the errors and re-run the minify command.",
        s = `<"file: instructions.txt">${t}</"file: instructions.txt">\n\n`;
      fs.appendFileSync(this.outputFilePath, s)
    }
  }
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
    }, {
      label: 'Ignore files ending in "min.css" and "min.js"?',
      value: "min",
      picked: true
    }, {
      label: "Ignore any other file or folder?",
      value: "other"
    }], {
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
    a = path.join(r, "_minifiedCodes.chatgpt"),
    c = getFiles(r, r, o, t, n),
    l = new Minifier(c, a);
  l.minifyFiles();
  const h = await vscode.workspace.openTextDocument(a);
  await vscode.window.showTextDocument(h, vscode.ViewColumn.Active)
});
exports.minifyCommand = minifyCommand;
