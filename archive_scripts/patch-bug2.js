import fs from 'fs';
let gCode = fs.readFileSync('src/services/geminiService.ts', 'utf8');

gCode = gCode.replace(/Number\(parsed\[s\.id\]\.score\)/g, 'extractNum(parsed[s.id].score)');
gCode = gCode.replace(/Number\(parsed\[s\.id\]\.percentile\)/g, 'extractNum(parsed[s.id].percentile)');
gCode = gCode.replace(/Number\(parsed\[s\.id\]\.accuracy\)/g, 'extractNum(parsed[s.id].accuracy)');

gCode = gCode.replace(/Number\(parsed\[s\]\.score\)/g, 'extractNum(parsed[s].score)');
gCode = gCode.replace(/Number\(parsed\[s\]\.percentile\)/g, 'extractNum(parsed[s].percentile)');
gCode = gCode.replace(/Number\(parsed\[s\]\.accuracy\)/g, 'extractNum(parsed[s].accuracy)');

fs.writeFileSync('src/services/geminiService.ts', gCode);
