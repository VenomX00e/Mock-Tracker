const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', 'utf8');

code = code.replace(/    if \(\!examType \|\| \!targetRole \|\| \!platform\) \{\n      return false;\n    \}/, 
`    if (!examType || !targetRole || !platform) {
      return true; // Return true so Jarvis can say the feedback message to ask for missing params
    }`);

fs.writeFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', code);
console.log("Patched addLiveMockAction to return true on missing params");
