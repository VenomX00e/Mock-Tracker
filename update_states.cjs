const fs = require('fs');

// 1. AppContext.tsx updates
let appContext = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

appContext = appContext.replace(
  'interface AppStateContextType {',
  'interface AppStateContextType {\n  activePublicProfile: any;\n  setActivePublicProfile: (profile: any) => void;\n  adminEditNotice: any;\n  setAdminEditNotice: (notice: any) => void;\n  adminEditCountdown: any;\n  setAdminEditCountdown: (countdown: any) => void;\n'
);

appContext = appContext.replace(
  '  const [mockToEdit, setMockToEdit] = useState<MockScore | undefined>(undefined);',
  '  const [mockToEdit, setMockToEdit] = useState<MockScore | undefined>(undefined);\n  const [activePublicProfile, setActivePublicProfile] = useState<any>(null);\n  const [adminEditNotice, setAdminEditNotice] = useState<any>(null);\n  const [adminEditCountdown, setAdminEditCountdown] = useState<any>(null);'
);

appContext = appContext.replace(
  'localCategory\n  }), [mockToEdit, editingChallenge, isOwner, isAdminUser, isAdmin, adminPermissions, localCategory]);',
  'localCategory,\n    activePublicProfile, setActivePublicProfile,\n    adminEditNotice, setAdminEditNotice,\n    adminEditCountdown, setAdminEditCountdown\n  }), [mockToEdit, editingChallenge, isOwner, isAdminUser, isAdmin, adminPermissions, localCategory, activePublicProfile, adminEditNotice, adminEditCountdown]);'
);

fs.writeFileSync('src/context/AppContext.tsx', appContext);

// 2. ModalsSection.tsx
let modals = fs.readFileSync('src/components/views/ModalsSection.tsx', 'utf-8');
const modalsUiRegex = /      activePublicProfile, setActivePublicProfile,\n/g;
modals = modals.replace(modalsUiRegex, ''); // remove from useUIStore
const useAppStateRegex = /const \{ setMockToEdit, editingChallenge, setEditingChallenge, isOwner \} = useAppStateCtx\(\);/g;
modals = modals.replace(useAppStateRegex, 'const { setMockToEdit, editingChallenge, setEditingChallenge, isOwner, activePublicProfile, setActivePublicProfile } = useAppStateCtx();');
fs.writeFileSync('src/components/views/ModalsSection.tsx', modals);

// 3. CommunityHub.tsx
let comm = fs.readFileSync('src/components/CommunityHub.tsx', 'utf-8');
comm = comm.replace(
  'const { adminPermissions, isOwner, setMockToEdit, setEditingChallenge, localCategory: categoryId } = useAppStateCtx();',
  'const { adminPermissions, isOwner, setMockToEdit, setEditingChallenge, localCategory: categoryId, setActivePublicProfile } = useAppStateCtx();'
);
comm = comm.replace(
  '  const { setActivePublicProfile, setIsCreateChallengeOpen, setIsRequestsModalOpen, setIsAddModalOpen } = useUIStore();',
  '  const { setIsCreateChallengeOpen, setIsRequestsModalOpen, setIsAddModalOpen } = useUIStore();'
);
fs.writeFileSync('src/components/CommunityHub.tsx', comm);

// 4. uiStore.ts
let store = fs.readFileSync('src/store/uiStore.ts', 'utf-8');
store = store.replace(/  activePublicProfile: any;\n  setActivePublicProfile: \(profile: any\) => void;\n\n/g, '');
store = store.replace(/  adminEditNotice: any;\n  setAdminEditNotice: \(notice: any\) => void;\n\n/g, '');
store = store.replace(/  adminEditCountdown: any;\n  setAdminEditCountdown: \(countdown: any\) => void;\n\n/g, '');

store = store.replace(/  activePublicProfile: null,\n  setActivePublicProfile: \(profile\) => set\(\{ activePublicProfile: profile \}\),\n\n/g, '');
store = store.replace(/  adminEditNotice: null,\n  setAdminEditNotice: \(notice\) => set\(\{ adminEditNotice: notice \}\),\n\n/g, '');
store = store.replace(/  adminEditCountdown: null,\n  setAdminEditCountdown: \(countdown\) => set\(\{ adminEditCountdown: countdown \}\),\n\n/g, '');

fs.writeFileSync('src/store/uiStore.ts', store);

