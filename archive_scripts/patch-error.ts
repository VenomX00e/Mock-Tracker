import fs from 'fs';

let text = fs.readFileSync('api-router.ts', 'utf8');

text = text.replace(/res\.status\(500\)\.json\(\{ error: formatGeminiError\(error\) \}\);/g, "res.status(500).json({ error: String(error.message || error) });");

fs.writeFileSync('api-router.ts', text);
