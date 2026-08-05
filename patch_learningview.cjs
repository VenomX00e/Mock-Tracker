const fs = require('fs');
let code = fs.readFileSync('src/components/learning/LearningView.tsx', 'utf8');

const importRegex = /import \{ jarvisEventBus \} from '\.\.\/\.\.\/features\/jarvis\/utils\/eventBus';/;
if (!importRegex.test(code)) {
    code = code.replace("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef } from 'react';\nimport { jarvisEventBus } from '../../features/jarvis/utils/eventBus';");
}

const effectCode = `
  useEffect(() => {
    const handleJarvisAction = (action: any) => {
      if (action.type === 'NAVIGATE' && action.payload) {
        const fullPath = action.payload.replace(/^\\//, '').toLowerCase();
        if (fullPath.includes('math')) setActiveTab('math');
        else if (fullPath.includes('vocab')) setActiveTab('vocab');
        else if (fullPath.includes('practice')) setActiveTab('practice');
        else if (fullPath.includes('ai tutor') || fullPath === 'learning/ai') setActiveTab('ai');
      }
    };
    const unsubscribe = jarvisEventBus.subscribe(handleJarvisAction);
    return () => unsubscribe();
  }, []);
`;

if (!code.includes("if (action.type === 'NAVIGATE' && action.payload)")) {
    code = code.replace(/const popoverRef = useRef<HTMLDivElement>\(null\);\s*const dropdownRef = useRef<HTMLDivElement>\(null\);\s*const setCanvases = useVocabularyStore\(state => state\.setCanvases\);/, "const popoverRef = useRef<HTMLDivElement>(null);\n  const dropdownRef = useRef<HTMLDivElement>(null);\n  const setCanvases = useVocabularyStore(state => state.setCanvases);\n" + effectCode);
}

fs.writeFileSync('src/components/learning/LearningView.tsx', code);
console.log("Patched LearningView.tsx");
