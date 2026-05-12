import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

// replace max-h-[500px] overflow-y-auto with overflow-visible
code = code.replace(/max-h-\[500px\] overflow-y-auto/g, "overflow-visible");

// replace max-h-60 overflow-y-auto with overflow-visible
code = code.replace(/max-h-60 overflow-y-auto/g, "overflow-visible");

fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log("Patched!");
