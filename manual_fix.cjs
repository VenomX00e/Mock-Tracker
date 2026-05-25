const fs = require('fs');

function applyModalsFix() {
  let text = fs.readFileSync('src/components/views/ModalsSection.tsx', 'utf-8');
  text = text.replace(
    'const { setMockToEdit, editingChallenge, setEditingChallenge, isOwner } = useAppStateCtx();',
    'const { setMockToEdit, editingChallenge, setEditingChallenge, isOwner, activePublicProfile, setActivePublicProfile, adminEditNotice, setAdminEditNotice, adminEditCountdown, setAdminEditCountdown } = useAppStateCtx();'
  );
  fs.writeFileSync('src/components/views/ModalsSection.tsx', text);
}

function applyViewManagerFix() {
  let text = fs.readFileSync('src/components/ViewManager.tsx', 'utf-8');
  text = text.replace(
    'const { isAdmin } = useAppStateCtx();',
    'const { isAdmin, adminEditNotice, adminEditCountdown } = useAppStateCtx();'
  );
  fs.writeFileSync('src/components/ViewManager.tsx', text);
}

function applyAppFix() {
  let text = fs.readFileSync('src/App.tsx', 'utf-8');
  text = text.replace(
    'const { profile } = useUserProfileCtx();',
    'const { profile } = useUserProfileCtx();\n  const { adminEditNotice, adminEditCountdown } = useAppStateCtx();'
  );
  fs.writeFileSync('src/App.tsx', text);
}

function applyNavFix() {
  let text = fs.readFileSync('src/components/Navigation.tsx', 'utf-8');
  text = text.replace(
    'const { adminPermissions, isOwner, setLocalCategory } = useAppStateCtx();',
    'const { adminPermissions, isOwner, setLocalCategory, setAdminEditNotice, setAdminEditCountdown } = useAppStateCtx();'
  );
  fs.writeFileSync('src/components/Navigation.tsx', text);
}

function applySidebarFix() {
  let text = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');
  text = text.replace(
    'const { isAdmin } = useAppStateCtx();',
    'const { isAdmin, setAdminEditNotice, setAdminEditCountdown } = useAppStateCtx();'
  );
  fs.writeFileSync('src/components/Sidebar.tsx', text);
}

function applyCountdownsPageFix() {
  let text = fs.readFileSync('src/components/views/CountdownsPage.tsx', 'utf-8');
  text = text.replace(
    'const { adminPermissions, isOwner } = useAppStateCtx();',
    'const { adminPermissions, isOwner, setAdminEditCountdown } = useAppStateCtx();'
  );
  fs.writeFileSync('src/components/views/CountdownsPage.tsx', text);
}

function applyCountdownsSectionFix() {
  let text = fs.readFileSync('src/components/views/CountdownsSection.tsx', 'utf-8');
  if (!text.includes('setAdminEditCountdown } = useAppStateCtx()')) {
    text = text.replace(
      'import { useUIStore } from \'../../store/uiStore\';',
      'import { useUIStore } from \'../../store/uiStore\';\nimport { useAppStateCtx } from \'../../context/AppContext\';'
    );
    text = text.replace(
      'const { activeTab, setAdminTab, setIsAdminModalOpen, setActiveTab } = useUIStore();',
      'const { activeTab, setAdminTab, setIsAdminModalOpen, setActiveTab } = useUIStore();\n  const { setAdminEditCountdown, adminPermissions } = useAppStateCtx();'
    );
  }
  fs.writeFileSync('src/components/views/CountdownsSection.tsx', text);
}

applyModalsFix();
applyViewManagerFix();
applyAppFix();
applyNavFix();
applySidebarFix();
applyCountdownsPageFix();
applyCountdownsSectionFix();
