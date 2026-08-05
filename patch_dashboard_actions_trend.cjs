const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', 'utf8');

if (code.includes("requiredParams: ['subject', 'examCategory']")) {
    code = code.replace(/requiredParams: \['subject', 'examCategory'\],/, "requiredParams: [],\n  optionalParams: ['subject', 'examCategory'],");
    fs.writeFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', code);
    console.log("Patched filterPerformanceTrendAction optionalParams");
}
