const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/services/jarvisIntentService.ts', 'utf8');

const replacement = `
    const requiredStr = action.requiredParams.length > 0 
      ? action.requiredParams.map(p => \`"\${p}": "value"\`).join(', ')
      : "";
    const optionalStr = (action.optionalParams && action.optionalParams.length > 0)
      ? action.optionalParams.map(p => \`"\${p}": "value (optional)"\`).join(', ')
      : "";
    
    let paramsSchema = "{}";
    if (requiredStr && optionalStr) {
        paramsSchema = \`{ \${requiredStr}, \${optionalStr} }\`;
    } else if (requiredStr) {
        paramsSchema = \`{ \${requiredStr} }\`;
    } else if (optionalStr) {
        paramsSchema = \`{ \${optionalStr} }\`;
    }

    return \`\${action.id} - \${action.description}. JSON PARAMETERS: \${paramsSchema}\`;
`;

code = code.replace(/const paramsSchema = action\.requiredParams.*?return `\$\{action\.id\} - \$\{action\.description\}\. REQUIRED JSON PARAMETERS: \$\{paramsSchema\}`;/s, replacement);

fs.writeFileSync('src/features/jarvis/services/jarvisIntentService.ts', code);
console.log("Patched jarvisIntentService.ts prompt");
