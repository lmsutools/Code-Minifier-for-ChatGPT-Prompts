const fs = require("fs");
const path = require("path");
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

    minifyPHP(content) {
        // Remove comments
        content = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
        // Remove whitespace
        content = content.replace(/\s+/g, ' ');
        // Remove whitespace around PHP tags
        content = content.replace(/\s*<\?php\s*/g, '<?php ');
        content = content.replace(/\s*\?>\s*/g, '?>');
        return content;
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
                    case "php":
                    case "phtml":
                        minifiedContent = this.minifyPHP(fileContent);
                        break;
                    case "twig":
                        minifiedContent = this.customMinify(fileContent);
                        break;
                    case "blade.php":
                        minifiedContent = this.minifyPHP(fileContent);
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

module.exports = Minifier;