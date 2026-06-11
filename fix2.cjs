const fs = require('fs');
const path = require('path');

const addedAttrs = 'autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-form-type="other"';

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // A simpler replacement: just find "<input " and replace it.
    // If it already has some of those, we might duplicate, but HTML/JSX takes the first or last depending on parser. 
    // Wait, in React, duplicates cause a compilation error! "JSX elements cannot have multiple attributes with the same name."
    // So we MUST NOT just mindlessly add. We should remove existing ones first if we do a dumb replace.

    // Better strategy: we parse the tags properly with a non-greedy .*? but we MUST NOT CROSS JSX TAG BOUNDARIES!
    // A tag boundary means it only contains spaces, letters, strings, and `{...}`.
    // Actually, it's easier to just use standard RegExp but prevent matching `>` inside `{ }`.
    // The previous issue was that `>` was matched inside `onChange={(e) => {`.
    
    // Instead of regex on the whole tag, we match `<input ` and `<textarea `, 
    // and just use regex to remove any existing autoComplete / data-1p-ignore etc on those specific files,
    // but doing so via simple replace might be tricky if we don't bounded correctly.

    // Let's just fix the specific issues the user has reported:
    // "mock name text box in the add mock page" -> AddMockDialog.tsx
    // The user said "Turn this off for every text box on the app"

    // Let's iterate line by line. If a line has `<input ` or `<textarea `, we can just inject our attributes.
    // But since attributes might be multi-line, it's safer to just inject it immediately after `<input `.
    // But we still need to avoid duplicates!
    content = content.replace(/autoComplete=(?:{[^}]+}|"[^"]*"|'[^']*')/g, '');
    content = content.replace(/data-1p-ignore=(?:{[^}]+}|"[^"]*"|'[^']*')/g, '');
    content = content.replace(/data-lpignore=(?:{[^}]+}|"[^"]*"|'[^']*')/g, '');
    content = content.replace(/data-form-type=(?:{[^}]+}|"[^"]*"|'[^']*')/g, '');

    // Now safely inject after `<input `
    content = content.replace(/<input /g, `<input ${addedAttrs} `);
    content = content.replace(/<input\n/g, `<input ${addedAttrs}\n`);

    content = content.replace(/<textarea /g, `<textarea ${addedAttrs} `);
    content = content.replace(/<textarea\n/g, `<textarea ${addedAttrs}\n`);

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
console.log('Safe fix complete.');
