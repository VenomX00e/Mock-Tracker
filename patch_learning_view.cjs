const fs = require('fs');
let code = fs.readFileSync('src/components/learning/LearningView.tsx', 'utf8');

code = code.replace(/import \{ jarvisEventBus \} from '\.\.\/\.\.\/features\/jarvis\/utils\/eventBus';\n/, "");

fs.writeFileSync('src/components/learning/LearningView.tsx', code);
console.log("Patched LearningView.tsx duplicate import");
