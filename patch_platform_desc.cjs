const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', 'utf8');

code = code.replace(/description: 'Allows the user to quickly create an active live mock. examType should be the broad category \(e.g., SBI, IBPS, RRB\). targetRole should be the role \(e.g., PO, Clerk\).',/,
"description: 'Allows the user to quickly create an active live mock. examType should be the broad category (e.g., SBI, IBPS, RRB). targetRole should be the role (e.g., PO, Clerk). platform is the provider (e.g., Guidely, Oliveboard, Smartkeeda, PracticeMock).',");

fs.writeFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', code);
console.log("Patched platform description");
