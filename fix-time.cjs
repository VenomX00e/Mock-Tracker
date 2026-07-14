const fs = require('fs');
let code = fs.readFileSync('api-router.ts', 'utf8');

const badStr = "`\\n\\n[System Note: The current date and time is ${istDateTime} (IST).]`;";
const goodStr = "`\\n\\nImportant Context: The current date and time is ${istDateTime} (Indian Standard Time). Please use this as the absolute reference for words like \"today\", \"tomorrow\", or \"recent\".`;";

code = code.replace(new RegExp(badStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), goodStr);

fs.writeFileSync('api-router.ts', code);
console.log("Replaced date string");
