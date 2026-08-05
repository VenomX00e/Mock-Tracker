const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/utils/eventBus.ts', 'utf8');

if (!code.includes("'SUB_NAVIGATE'")) {
    code = code.replace(/export type JarvisActionType = 'NAVIGATE' \| 'CHANGE_THEME' \| 'OPEN_SETTINGS' \| 'EXECUTE_INTENT' \| 'DISPATCH_INTENT' \| 'ACTION_RESULT';/, "export type JarvisActionType = 'NAVIGATE' | 'SUB_NAVIGATE' | 'CHANGE_THEME' | 'OPEN_SETTINGS' | 'EXECUTE_INTENT' | 'DISPATCH_INTENT' | 'ACTION_RESULT';");
    fs.writeFileSync('src/features/jarvis/utils/eventBus.ts', code);
    console.log("Patched eventBus.ts");
} else {
    console.log("Already patched.");
}
