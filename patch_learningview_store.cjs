const fs = require('fs');
let code = fs.readFileSync('src/components/learning/LearningView.tsx', 'utf8');

// replace local activeTab state with the store one
if (!code.includes('useUIStore(state => state.learningTab)')) {
    code = code.replace(/const \[activeTab, setActiveTab\] = useState\w*\(.*?\);/, 'const activeTab = useUIStore(state => state.learningTab);\n  const setActiveTab = useUIStore(state => state.setLearningTab);');
    
    // add import if needed
    if (!code.includes("import { useUIStore }")) {
        code = code.replace(/import \{ useAppStateCtx, usePublicSettingsCtx \} from '\.\.\/\.\.\/context\/AppContext';/, "import { useAppStateCtx, usePublicSettingsCtx } from '../../context/AppContext';\nimport { useUIStore } from '../../store/uiStore';");
    }
    
    // remove the jarvisEventBus useEffect we added earlier as it's no longer needed and causes issues
    code = code.replace(/useEffect\(\(\) => \{\s*const handleJarvisAction = \(action: any\) => \{[\s\S]*?unsubscribe\(\);\s*\}, \[\]\);/, '');

    fs.writeFileSync('src/components/learning/LearningView.tsx', code);
    console.log("Patched LearningView to use uiStore");
}
