const fs = require('fs');
let code = fs.readFileSync('api-router.ts', 'utf8');

const regex = /"originalSentenceBreakdown":\s*\{[\s\S]*?"fixReason"[^\}]*\}/;
const newSchema = `"originalSentenceBreakdown": {
      "prefix": "string (The part of the clean sentence BEFORE the error. DO NOT include A/B/C/D markers)",
      "errorText": "string (The exact word/phrase that is wrong)",
      "correctText": "string (The exact corrected word/phrase)",
      "suffix": "string (The part of the clean sentence AFTER the error. DO NOT include A/B/C/D markers)"
    }`;

code = code.replace(regex, newSchema);
fs.writeFileSync('api-router.ts', code);
