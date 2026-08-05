const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/DashboardCharts.tsx', 'utf8');

if (!code.includes('id="performance-trend"')) {
    code = code.replace(/<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">/, "<div id=\"performance-trend\" className=\"grid grid-cols-1 lg:grid-cols-2 gap-6 relative scroll-mt-24\">");
    fs.writeFileSync('src/components/dashboard/DashboardCharts.tsx', code);
    console.log("Patched DashboardCharts.tsx with id");
} else {
    console.log("Already patched");
}
