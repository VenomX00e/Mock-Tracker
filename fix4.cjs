const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // The string that replaced `=>`
    const badString = '= list="autocompleteOff">';
    
    // Split and join to replace all occurrences
    content = content.split(badString).join('=>');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Repaired ${filePath}`);
    }
}

function walk(dir) {
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.js')) {
            processFile(fullPath);
        }
    });
}

walk('./src');
console.log('Restoration complete.');
