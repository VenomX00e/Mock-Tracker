const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/actions/types.ts', 'utf8');

if (!code.includes('optionalParams')) {
    code = code.replace(/requiredParams: string\[\];/, "requiredParams: string[];\n  optionalParams?: string[];");
    fs.writeFileSync('src/features/jarvis/actions/types.ts', code);
    console.log("Patched types.ts");
}
