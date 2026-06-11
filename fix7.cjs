const fs = require('fs');
const path = require('path');

function dedupeAttributes(html) {
    // This is a naive regex but works perfectly for removing the EXACT strings we added 
    // if there are multiple.
    let countList = 0;
    html = html.replace(/list="autocompleteOff"/g, match => {
        countList++;
        return countList === 1 ? match : '';
    });
    
    let countAC = 0;
    html = html.replace(/autoComplete="new-password"/g, match => {
        countAC++;
        return countAC === 1 ? match : '';
    });
    return html;
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // A much safer way: find all `<input ...>` and parse deduplicate within the tag!
    content = content.replace(/<input([^>]+)>/g, (match) => {
        // Find all occurrences of list="..."
        let cleaned = match;
        
        let lists = cleaned.match(/list=(?:{[^}]+}|"[^"]*"|'[^']*')/g);
        if (lists && lists.length > 1) {
            // keep last one, remove others
            for (let i = 0; i < lists.length - 1; i++) {
                cleaned = cleaned.replace(lists[i], '');
            }
        }
        
        let acs = cleaned.match(/autoComplete=(?:{[^}]+}|"[^"]*"|'[^']*')/g);
        if (acs && acs.length > 1) {
            // keep last one, remove others
            for (let i = 0; i < acs.length - 1; i++) {
                cleaned = cleaned.replace(acs[i], '');
            }
        }
        
        return cleaned;
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Deduplicated ${filePath}`);
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
console.log('Deduplication complete.');
