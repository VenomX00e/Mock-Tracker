const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf-8');
code = code.replace(/useState<([\s\S]*?)>\("users"\);/, 'useState<$1 | "webhooks">("users");');
fs.writeFileSync('src/components/AdminDialog.tsx', code);
