const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', 'utf8');

code = code.replace(/id: 'add_live_mock',\n  description: 'Allows the user to quickly create an active live mock via voice\/text.',\n  requiredParams: \[\]/, "id: 'add_live_mock',\n  description: 'Allows the user to quickly create an active live mock via voice/text.',\n  requiredParams: ['examType', 'targetRole', 'platform']");

code = code.replace(/id: 'filter_performance_trend',\n  description: 'Allows the user to change the view of the Performance Trend chart.',\n  requiredParams: \[\]/, "id: 'filter_performance_trend',\n  description: 'Allows the user to change the view of the Performance Trend chart.',\n  requiredParams: ['subject', 'examCategory']");

fs.writeFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', code);
console.log("Patched params");
