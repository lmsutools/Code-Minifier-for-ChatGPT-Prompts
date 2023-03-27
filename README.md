💬 Code Minifier for ChatGPT Prompts

Welcome to the "Code Minifier for ChatGPT Prompts" VS Code extension! This nifty little extension was created to help you quickly prepare and arrange your code for use with ChatGPT by providing all the necessary context of your web application in a single prompt.

🤔 Why use it? 

As developers, we often need to generate code using ChatGPT, but to get the best results, we should provide it with the full context of our project. We also need to save tokens space while prompting and our beautified code just wouldn't be efficient. 

This extension makes it super easy by creating a minified summary file of your web project which you can then copy and paste into ChatGPT.


This extension was carefully crafted through over 100 iterations using ChatGPT-3.5-Turbo and ChatGPT-4. This progressive feature-building strategy was necessary because even ChatGPT-4 sometimes generates incorrect code if you ask it to build a lot of features at the same time. In addition, ChatGPT needed some code examples to understand some problems and tWhese were fetched from Stack Overflow.

📦 Example Output 

When you run the extension, it will generate a file called _minifiedCodes.chatgpt in your project's root directory. Here's a little example of how the output might look like:

<"file: script.js">function factorial(n){return 0===n?1:n*factorial(n-1)}</"file: script.js">

🚀How to use it? 

- Install the VS Code Minify for ChatGPT extension from the VS Code Marketplace.
- Open your project folder in VS Code.
- Press Ctrl+Shift+P (or Cmd+Shift+P on macOS) to open the Command Palette.
- Type Code Minifier for ChatGPT Prompts and hit Enter to start the 🧙‍♂️ magic! 

(Optional) You can also ignore specific files or folders by entering their names when prompted. Just separate them with commas, like this: folder1, file1.js.

Voilà! A minified summary file named minifiedForChatGPT will be created in your project's root directory. 

🎉 Now you can easily copy and paste the content into ChatGPT to provide all the context it needs!
