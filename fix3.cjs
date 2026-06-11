const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // We will change autoComplete="off" to autoComplete="one-time-code" which strictly disables History/Autofill in most modern browsers.
    content = content.replace(/autoComplete="off"/g, 'autoComplete="none"');

    // Add list="autocompleteOff" to input tags if not present
    content = content.replace(/<input\b([^>]*)>/gi, (match, attrs) => {
        if (!attrs.includes('list=')) {
            // make sure we don't break self-closing
            if (attrs.endsWith('/')) {
                return `<input${attrs.slice(0, -1)} list="autocompleteOff" />`;
            }
            return `<input${attrs} list="autocompleteOff">`;
        }
        return match;
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${filePath}`);
    }
}

function walk(dir) {
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
            processFile(fullPath);
        }
    });
}

walk('./src');
