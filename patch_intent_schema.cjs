const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/services/jarvisIntentService.ts', 'utf8');

code = code.replace(/parameters: \{\s*type: Type\.OBJECT,\s*properties: Object\.keys\(properties\)\.length > 0 \? properties : undefined\s*\}/,
`parameters: { 
  type: Type.OBJECT,
  description: "A dictionary of key-value pairs matching the JSON PARAMETERS of the chosen action."
}`);

fs.writeFileSync('src/features/jarvis/services/jarvisIntentService.ts', code);
console.log("Patched jarvisIntentService.ts to remove global properties schema");
