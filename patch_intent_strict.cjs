const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/services/jarvisIntentService.ts', 'utf8');

code = code.replace(/You must output ONLY a JSON object matching one of the available actions./, 
"You must output ONLY a JSON object matching one of the available actions. IMPORTANT: You must ONLY include parameters that are explicitly listed as JSON PARAMETERS for the specific action you choose. Do NOT hallucinate parameters from other actions (like 'theme') if they are not listed for the action you chose.");

fs.writeFileSync('src/features/jarvis/services/jarvisIntentService.ts', code);
console.log("Patched jarvisIntentService.ts strictness");
