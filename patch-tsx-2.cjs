const fs = require('fs');
let code = fs.readFileSync('src/components/Navigation.tsx', 'utf-8');
code = code.replace(/setTheme\(color\.id\)/g, "setTheme(color.id as any)");
fs.writeFileSync('src/components/Navigation.tsx', code);

code = fs.readFileSync('src/components/ProfileDialog.tsx', 'utf-8');
code = code.replace(/setTheme\(color\.id\)/g, "setTheme(color.id as any)");
fs.writeFileSync('src/components/ProfileDialog.tsx', code);
