const fs = require('fs');

function applyRegexFix(filePath) {
    if (!fs.existsSync(filePath)) return;
    let text = fs.readFileSync(filePath, 'utf-8');
    
    // Make sure useUIStore is imported
    if (/(mockToEdit|setMockToEdit|editingChallenge|setEditingChallenge|activePublicProfile|setActivePublicProfile|adminEditNotice|setAdminEditNotice|adminEditCountdown|setAdminEditCountdown)/.test(text) && !text.includes('useUIStore')) {
        let depth = (filePath.match(/\//g) || []).length;
        let upDir = '../'.repeat(depth - 1) || './';
        text = `import { useUIStore } from '${upDir}store/uiStore';\n` + text;
    }

    // Capture the existing useUIStore destructuring if any
    let uiStoreDestructure = [];
    text.replace(/const\s+\{([^}]+)\}\s*=\s*useUIStore\(\)/g, (match, p1) => {
        uiStoreDestructure.push(...p1.split(',').map(s => s.trim()).filter(Boolean));
        return match;
    });

    const varsToMove = ['mockToEdit', 'setMockToEdit', 'editingChallenge', 'setEditingChallenge', 'activePublicProfile', 'setActivePublicProfile', 'adminEditNotice', 'setAdminEditNotice', 'adminEditCountdown', 'setAdminEditCountdown'];

    // For any destructured variable from useAppStateCtx that is in the varsToMove list, remove it
    // and remember it.
    let extractedVars = [];
    
    text = text.replace(/const\s+\{([^}]+)\}\s*=\s*(?:useAppStateCtx\(\)|useContext\(AppStateCtx\)!?)/g, (match, p1) => {
        let vars = p1.split(',').map(s => s.trim());
        let keptVars = [];
        for (let v of vars) {
             let baseVar = v.split(':')[0].trim();
             if (varsToMove.includes(baseVar) || varsToMove.includes(v)) { // Handle aliases like handleUpdateProfileTasks: onUpdateProfileTasks, or setMockToEdit
                 extractedVars.push(v);
             } else if (v) {
                 keptVars.push(v);
             }
        }
        
        if (keptVars.length === 0) return '';
        
        let assignment = match.includes('useAppStateCtx') ? 'useAppStateCtx()' : match.match(/useContext\(AppStateCtx\)!?/)[0];
        return `const { ${keptVars.join(', ')} } = ${assignment}`;
    });

    // Now inject the extractedVars into the existing useUIStore call. If one doesn't exist, create it.
    if (extractedVars.length > 0) {
        // filter out from extractedVars anything already in uiStoreDestructure
        let toInject = extractedVars.filter(v => !uiStoreDestructure.includes(v.split(':')[0].trim()));
        if (toInject.length > 0) {
            if (text.includes(' = useUIStore()')) {
                text = text.replace(/const\s+\{([^}]+)\}\s*=\s*useUIStore\(\)/, (match, p1) => {
                    return `const { ${p1.trim()}, ${toInject.join(', ')} } = useUIStore()`;
                });
            } else {
                // Find a good place to inject. Usually after useAppStateCtx.
                text = text.replace(/(const \{.*\} = (?:useAppStateCtx\(\)|useContext\(AppStateCtx\)!?);)/, `$1\n  const { ${toInject.join(', ')} } = useUIStore();`);
            }
        }
    }
    
    fs.writeFileSync(filePath, text);
}

const files = [
    'src/App.tsx',
    'src/components/BottomNav.tsx',
    'src/components/CommunityHub.tsx',
    'src/components/Dashboard.tsx',
    'src/components/Navigation.tsx',
    'src/components/Sidebar.tsx',
    'src/components/ViewManager.tsx',
    'src/components/views/ChallengesSection.tsx',
    'src/components/views/CountdownsPage.tsx',
    'src/components/views/CountdownsSection.tsx',
    'src/components/views/LiveMocksSection.tsx',
    'src/components/views/ModalsSection.tsx'
];

files.forEach(applyRegexFix);
