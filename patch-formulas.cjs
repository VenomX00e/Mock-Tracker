const fs = require('fs');
let code = fs.readFileSync('api-router.ts', 'utf8');

code = code.replace(
  '{ "text": "string (Valid formula / rule structure)", "isValid": true }',
  '{ "text": "string (Valid formula / rule structure. MUST USE Markdown: `keywords` in backticks, **parts of speech** in bold, and *(examples)* in italics.)", "isValid": true }'
);

code = code.replace(
  '{ "text": "most + Plural Countable Noun (e.g., most regions)", "isValid": true }',
  '{ "text": "`most` + **Plural Countable Noun** *(e.g., most regions)*", "isValid": true }'
);

code = code.replace(
  '{ "text": "most + Singular Countable Noun (e.g., most region)", "isValid": false }',
  '{ "text": "`most` + **Singular Countable Noun** *(e.g., most region)*", "isValid": false }'
);

code = code.replace(
  '{ "text": "Had + Subject + V3 ... Subject + would / could / might + have + V3", "isValid": true }',
  '{ "text": "`Had` + **Subject** + **V3** ... **Subject** + `would / could / might have` + **V3**", "isValid": true }'
);

code = code.replace(
  '{ "text": "Had + Subject + V3 ... will have / would + V1", "isValid": false }',
  '{ "text": "`Had` + **Subject** + **V3** ... `will have` / `would` + **V1**", "isValid": false }'
);

fs.writeFileSync('api-router.ts', code);
