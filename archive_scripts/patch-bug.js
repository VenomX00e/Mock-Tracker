import fs from 'fs';

let apiCode = fs.readFileSync('api-router.ts', 'utf8');
apiCode = apiCode.replace(/score: \{ type: Type\.NUMBER \}/g, 'score: { type: Type.STRING, description: "Extract numerator. E.g. 16/30 -> 16" }');
apiCode = apiCode.replace(/percentile: \{ type: Type\.NUMBER \}/g, 'percentile: { type: Type.STRING, description: "E.g. 84.62" }');
apiCode = apiCode.replace(/percentage: \{ type: Type\.NUMBER \}/g, 'percentage: { type: Type.STRING }');
apiCode = apiCode.replace(/accuracy: \{ type: Type\.NUMBER \}/g, 'accuracy: { type: Type.STRING, description: "E.g. 72.93" }');
fs.writeFileSync('api-router.ts', apiCode);

let gCode = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const helper = `
function extractNum(val: any): number | null {
  if (val == null || val === '') return null;
  const str = String(val).trim();
  const match = str.match(/(?:\\b|^)-?\\d+(?:\\.\\d+)?/);
  if (match) return Number(match[0]);
  return null;
}
`;
if (!gCode.includes('function extractNum')) {
    gCode = gCode.replace('export async function parseScorecardImage', helper + '\nexport async function parseScorecardImage');
}
gCode = gCode.replace(/Number\(parsed\[s\.id\]\?\.score\)/g, 'extractNum(parsed[s.id]?.score)');
gCode = gCode.replace(/Number\(parsed\[s\.id\]\?\.percentile\)/g, 'extractNum(parsed[s.id]?.percentile)');
gCode = gCode.replace(/Number\(parsed\[s\.id\]\?\.accuracy\)/g, 'extractNum(parsed[s.id]?.accuracy)');

gCode = gCode.replace(/Number\(parsed\[s\]\?\.score\)/g, 'extractNum(parsed[s]?.score)');
gCode = gCode.replace(/Number\(parsed\[s\]\?\.percentile\)/g, 'extractNum(parsed[s]?.percentile)');
gCode = gCode.replace(/Number\(parsed\[s\]\?\.accuracy\)/g, 'extractNum(parsed[s]?.accuracy)');

gCode = gCode.replace(/Number\(parsed\.score\)/g, 'extractNum(parsed.score)');
gCode = gCode.replace(/Number\(parsed\.percentile\)/g, 'extractNum(parsed.percentile)');
gCode = gCode.replace(/Number\(parsed\.percentage\)/g, 'extractNum(parsed.percentage)');
gCode = gCode.replace(/Number\(parsed\.accuracy\)/g, 'extractNum(parsed.accuracy)');

fs.writeFileSync('src/services/geminiService.ts', gCode);
