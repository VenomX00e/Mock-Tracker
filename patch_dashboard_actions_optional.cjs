const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', 'utf8');

if (!code.includes("optionalParams: ['phase'")) {
    code = code.replace(/requiredParams: \['examType', 'targetRole', 'platform'\],/, "requiredParams: ['examType', 'targetRole', 'platform'],\n  optionalParams: ['phase', 'scope', 'mockName'],");
    fs.writeFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', code);
    console.log("Patched dashboardActions.ts optionalParams");
}
