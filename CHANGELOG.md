# Change Log

v0.4.3
Added checklist options in the UI palette to ask to ignore min.css and min.js files.
Ignore .git folder
Creation of error logs at the end of _minifiedCodes.chatgpt file
Published at Github

v0.4.2
 Replaced the glob.sync usage in the if condition inside the n.forEach loop with minimatch to better handle the ignore patterns. 

 v0.4.1
With these changes, the `getFiles` function now takes the ignore patterns into account and uses the `glob` package to handle the file matching. The `ignore.chatgpt` file format has been updated to use double asterisks (`**`) to match all files and subfolders within the specified folder.

v0.4
Ignores any file named package-lock.json.
Asks the user if they want to ignore any other file or folder, and lets the user input a file name or folder.
Uses the root folder that the VS Code window has opened. It only opens the dialog to choose a folder if there's no folder opened.
Created a new readme.md file generated by ChatGPT.

v0.3
With these changes, the extension will ignore the node_modules folder and include only the relative path starting from the root folder in the output.

v0.2 
Now, the extension will create a new file called minifiedForChatGPT in the root folder with the minified code when a folder is selected. If the file already exists, it will be overwritten without asking, and the file will be opened in the current VS Code window.

v0.1.1
Fixed the UI palette

v0.1
Initial release







