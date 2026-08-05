const fs = require('fs');
let code = fs.readFileSync('src/components/CommunityHub.tsx', 'utf8');

const importRegex = /import \{ jarvisEventBus \} from '\.\.\/features\/jarvis\/utils\/eventBus';/;
if (!importRegex.test(code)) {
    code = code.replace(/import React, \{ useState, useEffect \} from 'react';/, "import React, { useState, useEffect } from 'react';\nimport { jarvisEventBus } from '../features/jarvis/utils/eventBus';");
}

const newEffect = `
  useEffect(() => {
    const handleSubNavigate = (action: any) => {
      if (action.type === 'SUB_NAVIGATE') {
        const { mainTab, subTab, section } = action.payload;
        if (mainTab === 'community' && subTab) {
            if (subTab === 'leaderboard') setActiveTab('leaderboard');
            else if (subTab === 'log' || subTab === 'community-log') setActiveTab('log');
            else if (subTab === 'chat' || subTab === 'community-chat') setActiveTab('chat');
        }
      }
    };
    const unsubscribe = jarvisEventBus.subscribe(handleSubNavigate);
    return () => unsubscribe();
  }, []);
`;

if (!code.includes("if (action.type === 'SUB_NAVIGATE')")) {
    code = code.replace(/const \{ mocks \} = useMocks\(\);/, "const { mocks } = useMocks();\n" + newEffect);
    fs.writeFileSync('src/components/CommunityHub.tsx', code);
    console.log("Patched CommunityHub to handle SUB_NAVIGATE");
} else {
    console.log("CommunityHub already handles SUB_NAVIGATE");
}
