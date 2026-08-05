const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', 'utf8');

code = code.replace(/description: 'Allows the user to change the view of the Performance Trend chart.',/, 
"description: 'Allows the user to filter the Performance Trend chart by subject or exam category. Use this if the user wants to see their performance or stats for a specific exam (like IBPS, SBI) or subject (like Quant, Reasoning).',");

fs.writeFileSync('src/features/jarvis/actions/dashboard/dashboardActions.ts', code);
console.log("Patched filterPerformanceTrendAction description");
