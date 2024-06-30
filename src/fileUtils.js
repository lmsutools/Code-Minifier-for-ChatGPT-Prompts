const fs = require("fs");
const path = require("path");

function normalizeIgnorePath(ignorePath) {
    // Convert Windows backslashes to forward slashes
    ignorePath = ignorePath.replace(/\\/g, '/');
    
    // Remove leading and trailing slashes
    ignorePath = ignorePath.replace(/^\/|\/$/g, '');
    
    return ignorePath;
}

function getFiles(rootPath, currentPath, ignoreList, ignoreDotFiles, ignoreMinFiles) {
    const files = [];
    const directoryItems = fs.readdirSync(currentPath);
    ignoreList = ignoreList.concat(["package-lock.json", "dist", "obj", "bin", ".vscode"]);

    for (const itemName of directoryItems) {
        const itemPath = path.join(currentPath, itemName);
        const relativePath = path.relative(rootPath, itemPath);
        const normalizedRelativePath = normalizeIgnorePath(relativePath);
        const itemExtension = path.extname(itemName);

        if (ignoreList.includes(itemName) || 
            ignoreList.includes(normalizedRelativePath) || 
            ignoreList.includes(itemExtension) ||
            ignoreList.some(ignorePath => normalizedRelativePath.startsWith(ignorePath))) {
            continue;
        }

        const itemStat = fs.statSync(itemPath);

        if (itemStat.isDirectory()) {
            if (itemName.startsWith("env_") || itemName === "node_modules" || itemName === ".git" || itemName === "vendor") {
                continue;
            }
            files.push(...getFiles(rootPath, itemPath, ignoreList, ignoreDotFiles, ignoreMinFiles));
        } else if (itemStat.isFile()) {
            if ((ignoreDotFiles && itemName.startsWith(".")) || (ignoreMinFiles && (itemExtension === ".min.js" || itemExtension === ".min.css"))) {
                continue;
            }
            let extension = itemExtension.substring(1);
            if (itemName.endsWith('.blade.php')) {
                extension = 'blade.php';
            }
            files.push({ path: relativePath, name: itemName, extension: extension, modifiedTime: itemStat.mtime });
        }
    }
    return files;
}

module.exports = {
    getFiles,
    normalizeIgnorePath
};