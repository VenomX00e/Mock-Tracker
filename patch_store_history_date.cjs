const fs = require('fs');
let code = fs.readFileSync('src/store/analyticsStore.ts', 'utf8');

if (!code.includes('selectedHistoryDate')) {
    code = code.replace(/statsCountRange: number \| 'all';/, "statsCountRange: number | 'all';\n  selectedHistoryDate: string | null;");
    code = code.replace(/statsCountRange: 'all',/, "statsCountRange: 'all',\n  selectedHistoryDate: null,");
    fs.writeFileSync('src/store/analyticsStore.ts', code);
    console.log("Patched store with selectedHistoryDate");
}
