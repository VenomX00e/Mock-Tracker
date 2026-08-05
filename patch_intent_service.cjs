const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/services/jarvisIntentService.ts', 'utf8');

if (!code.includes('a.optionalParams')) {
    code = code.replace(/Object.values\(actionRegistry\).forEach\(a => a.requiredParams.forEach\(p => allParams.add\(p\)\)\);/, 
    `Object.values(actionRegistry).forEach(a => {
    a.requiredParams.forEach(p => allParams.add(p));
    if (a.optionalParams) {
      a.optionalParams.forEach(p => allParams.add(p));
    }
  });`);
    fs.writeFileSync('src/features/jarvis/services/jarvisIntentService.ts', code);
    console.log("Patched jarvisIntentService.ts");
}
