const fs = require('fs');
let code = fs.readFileSync('src/components/learning/PracticeLibrary.tsx', 'utf8');

const importRegex = /import \{ jarvisEventBus \} from '\.\.\/\.\.\/features\/jarvis\/utils\/eventBus';/;
if (!importRegex.test(code)) {
    code = code.replace(/import React, \{ useState, useEffect \} from 'react';/, "import React, { useState, useEffect } from 'react';\nimport { jarvisEventBus } from '../../features/jarvis/utils/eventBus';");
}

const newEffect = `
  useEffect(() => {
    const handleSubNavigate = (action: any) => {
      if (action.type === 'SUB_NAVIGATE') {
        const { mainTab, subTab, section } = action.payload;
        if (mainTab === 'learning' && subTab === 'practice' && section) {
            // Find the subject id that matches the section name
            if (section === 'quant') setCurrentSubjectId('quant');
            else if (section === 'reasoning') setCurrentSubjectId('reasoning');
            else if (section === 'english') setCurrentSubjectId('english');
            else if (section === 'ga') setCurrentSubjectId('ga');
        }
      }
    };
    const unsubscribe = jarvisEventBus.subscribe(handleSubNavigate);
    return () => unsubscribe();
  }, []);
`;

if (!code.includes("if (action.type === 'SUB_NAVIGATE')")) {
    code = code.replace(/const \[loading, setLoading\] = useState\(false\);/, "const [loading, setLoading] = useState(false);\n" + newEffect);
    fs.writeFileSync('src/components/learning/PracticeLibrary.tsx', code);
    console.log("Patched PracticeLibrary to handle SUB_NAVIGATE");
} else {
    console.log("PracticeLibrary already handles SUB_NAVIGATE");
}
