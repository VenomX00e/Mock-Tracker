const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // Remove existing list="autocompleteOff" to prevent duplicates
    content = content.replace(/ list="autocompleteOff"/g, '');

    // Inject list="autocompleteOff"
    content = content.replace(/<input /g, '<input list="autocompleteOff" autoComplete="off" ');
    content = content.replace(/<input\n/g, '<input list="autocompleteOff" autoComplete="off"\n');
    
    // Cleanup any duplicates of autoComplete from previous attempts
    // This is safe because JS replace is sequential, we just added 'autoComplete="off"' at the start.
    // If there is another autoComplete="none" down the tag, React might warn but it will use the last one.
    // Actually, React throws an error if there are duplicate props! 
    // We must parse properly. Since we can't parse easily with regex, we should just replace ALL existing
    // autoComplete="..." with nothing, and then inject ours.
    content = content.replace(/autoComplete=(?:{[^}]+}|"[^"]*"|'[^']*')/g, '');
    
    // Inject our final anti-autofill attributes:
    const antiAutofill = `list="autocompleteOff" autoComplete="new-password"`;
    content = content.replace(/<input /g, `<input ${antiAutofill} `);
    content = content.replace(/<input\n/g, `<input ${antiAutofill}\n`);

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${filePath}`);
    }
}

function processAddMock(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;
    
    // Change label and use anonymous change handler to avoid 'name' triggering
    content = content.replace(/<label(.*?)>Mock Name<\/label>/g, '<label$1>Mock Title</label>');
    
    // Re-write the mockName input
    const inputRegex = /<input([^>]*)name="mockName"([^>]*)onChange={handleChange}([^>]*)>/g;
    content = content.replace(inputRegex, '<input$1$2onChange={(e) => setFormData({...formData, mockName: e.target.value})}$3>');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Specific Fix ${filePath}`);
    }
}

function walk(dir) {
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
            processFile(fullPath);
            if (fullPath.includes('AddMockDialog.tsx') || fullPath.includes('AddLiveMockDialog.tsx')) {
                processAddMock(fullPath);
            }
        }
    });
}

walk('./src');
console.log('Final fix complete.');
