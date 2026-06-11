const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // Use regex to locate <input ...> and <textarea ...> tags
    content = content.replace(/<(input|textarea)([\s\S]*?)(\/?)>/g, (match, tag, attrs, closingSlash) => {
        // If it's something like <input />
        let newAttrs = attrs;
        
        // Remove existing attributes that we are going to override
        newAttrs = newAttrs.replace(/\s+autoComplete=(?:{[^}]+}|"[^"]*"|'[^']*')/g, '');
        newAttrs = newAttrs.replace(/\s+autoCorrect=(?:{[^}]+}|"[^"]*"|'[^']*')/g, '');
        newAttrs = newAttrs.replace(/\s+spellCheck=(?:{[^}]+}|"[^"]*"|'[^']*')/g, '');
        newAttrs = newAttrs.replace(/\s+data-1p-ignore=(?:{[^}]+}|"[^"]*"|'[^']*')/g, '');
        newAttrs = newAttrs.replace(/\s+data-lpignore=(?:{[^}]+}|"[^"]*"|'[^']*')/g, '');
        newAttrs = newAttrs.replace(/\s+data-form-type=(?:{[^}]+}|"[^"]*"|'[^']*')/g, '');

        // Add our overriding attributes
        let additions = ' autoComplete="off" autoCorrect="off" spellCheck={false} data-1p-ignore="true" data-lpignore="true" data-form-type="other"';
        
        return `<${tag}${newAttrs}${additions}${closingSlash ? ' />' : '>'}`;
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
console.log('Done fixing inputs.');
