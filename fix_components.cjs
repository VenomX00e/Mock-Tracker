const fs = require('fs');

function fixFile(filePath) {
  let text = fs.readFileSync(filePath, 'utf-8');

  // Need to add `useUIStore` import if missing
  const needsUiStore = /(mockToEdit|setMockToEdit|editingChallenge|setEditingChallenge|activePublicProfile|setActivePublicProfile|adminEditNotice|setAdminEditNotice|adminEditCountdown|setAdminEditCountdown)/.test(text);
  
  if (needsUiStore && !text.includes('useUIStore')) {
    // Add import right after useAppStateCtx or similar
    if (text.includes("import { useAppStateCtx")) {
        text = text.replace(/(import \{.*?useAppStateCtx.*?\} from '.*?';)/, "$1\nimport { useUIStore } from '../store/uiStore';");
    } else {
        text = "import { useUIStore } from '../store/uiStore';\n" + text;
    }

    // Fix relative paths manually later or just use naive relative path based on directory depth
    let depth = (filePath.match(/\//g) || []).length;
    let upDir = '../'.repeat(depth - 1) || './';
    text = text.replace(/'.\/store\/uiStore'/g, `'${upDir}store/uiStore'`);
    text = text.replace(/'.\/..\/store\/uiStore'/g, `'${upDir}store/uiStore'`);
  }

  // Remove variables from useAppStateCtx
  text = text.replace(/(mockToEdit|setMockToEdit|editingChallenge|setEditingChallenge|activePublicProfile|setActivePublicProfile|adminEditNotice|setAdminEditNotice|adminEditCountdown|setAdminEditCountdown)(,\s*|\s*,\s*|\s*)/g, function(match, p1, p2) {
      if (text.substring(Math.max(0, text.indexOf(match) - 30), text.indexOf(match)).includes('useAppStateCtx')) {
          return '';
      }
      return match;
  });

  // Since we might have messed up the useAppStateCtx destructing, let's just use string replace.
  
  fs.writeFileSync(filePath, text);
}

// More surgical replacements:
function replaceSurgically(filePath, from, to) {
    if (!fs.existsSync(filePath)) return;
    let text = fs.readFileSync(filePath, 'utf-8');
    text = text.replace(from, to);
    fs.writeFileSync(filePath, text);
}

// App.tsx
replaceSurgically('src/App.tsx', 
    'const { adminPermissions, mockToEdit, setMockToEdit } = useAppStateCtx();',
    'const { adminPermissions } = useAppStateCtx();\n  const { mockToEdit, setMockToEdit } = useUIStore();'
);

// BottomNav.tsx
replaceSurgically('src/components/BottomNav.tsx', 
    'const { isAdmin, setMockToEdit } = useAppStateCtx();',
    'const { isAdmin } = useAppStateCtx();\n  const { setMockToEdit } = useUIStore();'
);

// CommunityHub.tsx
replaceSurgically('src/components/CommunityHub.tsx',
    'const { isOwner, isAdmin, setMockToEdit, setEditingChallenge, setActivePublicProfile } = useAppStateCtx();',
    'const { isOwner, isAdmin } = useAppStateCtx();\n  const { setMockToEdit, setEditingChallenge, setActivePublicProfile } = useUIStore();'
);

// Dashboard.tsx
replaceSurgically('src/components/Dashboard.tsx',
    'const { isOwner, isAdmin, adminPermissions, handleUpdateProfileTasks, setMockToEdit } = useAppStateCtx();',
    'const { isOwner, isAdmin, adminPermissions, handleUpdateProfileTasks } = useAppStateCtx();\n  const { setMockToEdit } = useUIStore();'
);

// Navigation.tsx
replaceSurgically('src/components/Navigation.tsx',
    'const { isOwner, isAdmin, adminPermissions, setMockToEdit, setAdminEditNotice, setAdminEditCountdown } =\n    useAppStateCtx();',
    'const { isOwner, isAdmin, adminPermissions } =\n    useAppStateCtx();\n  const { setMockToEdit, setAdminEditNotice, setAdminEditCountdown } = useUIStore();'
);

// Sidebar.tsx
replaceSurgically('src/components/Sidebar.tsx',
    'const { isOwner, isAdmin, adminPermissions, setMockToEdit, setAdminEditNotice, setAdminEditCountdown } = useAppStateCtx();',
    'const { isOwner, isAdmin, adminPermissions } = useAppStateCtx();\n  const { setMockToEdit, setAdminEditNotice, setAdminEditCountdown } = useUIStore();'
);
replaceSurgically('src/components/Sidebar.tsx',
    '  const { setAdminEditNotice, setAdminEditCountdown } = useUIStore();',
    ''
);
replaceSurgically('src/components/Sidebar.tsx',
    '    setAdminTab\n  } = useUIStore();',
    '    setAdminTab,\n    setMockToEdit, \n    setAdminEditNotice, \n    setAdminEditCountdown\n  } = useUIStore();'
);

// ViewManager.tsx
replaceSurgically('src/components/ViewManager.tsx',
    'const { isOwner, isAdmin, adminPermissions, mockToEdit, setMockToEdit, adminEditNotice, adminEditCountdown } = useContext(AppStateCtx)!;',
    'const { isOwner, isAdmin, adminPermissions } = useContext(AppStateCtx)!;\n  const { mockToEdit, setMockToEdit, adminEditNotice, adminEditCountdown } = useUIStore();'
);

// ChallengesSection.tsx
replaceSurgically('src/components/views/ChallengesSection.tsx',
    'const { isOwner, isAdmin, adminPermissions, setEditingChallenge } = useAppStateCtx();',
    'const { isOwner, isAdmin, adminPermissions } = useAppStateCtx();\n  const { setEditingChallenge } = useUIStore();'
);

// CountdownsPage.tsx
replaceSurgically('src/components/views/CountdownsPage.tsx',
    'const { adminPermissions, setAdminEditCountdown } = useAppStateCtx();',
    'const { adminPermissions } = useAppStateCtx();\n  const { setAdminEditCountdown } = useUIStore();'
);
replaceSurgically('src/components/views/CountdownsPage.tsx',
    'const { setAdminTab, setIsAdminModalOpen, setActiveTab } = useUIStore();',
    'const { setAdminTab, setIsAdminModalOpen, setActiveTab, setAdminEditCountdown } = useUIStore();'
);
replaceSurgically('src/components/views/CountdownsPage.tsx',
    '  const { setAdminEditCountdown } = useUIStore();',
    ''
);


// CountdownsSection.tsx
replaceSurgically('src/components/views/CountdownsSection.tsx',
    'const { setAdminEditCountdown, adminPermissions } = useAppStateCtx();',
    'const { adminPermissions } = useAppStateCtx();\n  const { setAdminEditCountdown } = useUIStore();'
);
replaceSurgically('src/components/views/CountdownsSection.tsx',
    '  const { setAdminEditCountdown } = useUIStore();\n\n  const [tappedCountdownId',
    '\n  const [tappedCountdownId'
);
replaceSurgically('src/components/views/CountdownsSection.tsx',
    'const { activeTab, setAdminTab, setIsAdminModalOpen, setActiveTab } = useUIStore();',
    'const { activeTab, setAdminTab, setIsAdminModalOpen, setActiveTab, setAdminEditCountdown } = useUIStore();'
);

// LiveMocksSection.tsx
replaceSurgically('src/components/views/LiveMocksSection.tsx',
    'const { isOwner, isAdmin, adminPermissions, setMockToEdit } = useAppStateCtx();',
    'const { isOwner, isAdmin, adminPermissions } = useAppStateCtx();\n  const { setMockToEdit } = useUIStore();'
);


// ModalsSection.tsx
replaceSurgically('src/components/views/ModalsSection.tsx',
    'const { mockToEdit, setMockToEdit, editingChallenge, setEditingChallenge, adminPermissions, isOwner, isAdmin, activePublicProfile, setActivePublicProfile, adminEditNotice, setAdminEditNotice, adminEditCountdown, setAdminEditCountdown } = useAppStateCtx();',
    'const { adminPermissions, isOwner, isAdmin } = useAppStateCtx();\n  const { mockToEdit, setMockToEdit, editingChallenge, setEditingChallenge, activePublicProfile, setActivePublicProfile, adminEditNotice, setAdminEditNotice, adminEditCountdown, setAdminEditCountdown } = useUIStore();'
);

