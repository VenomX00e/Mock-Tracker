const fs = require('fs');

const code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const returnStarts = [...code.matchAll(/return \(/g)].map(m => m.index);

console.log(returnStarts);
