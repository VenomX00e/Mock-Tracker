const fs = require('fs');

// 1. Add to useUIStore.ts
let uiStore = fs.readFileSync('src/store/uiStore.ts', 'utf-8');
const interfaceAdditions = `
  mockToEdit: any | undefined;
  setMockToEdit: (mock: any) => void;
  editingChallenge: any | null;
  setEditingChallenge: (challenge: any | null) => void;
  activePublicProfile: any | null;
  setActivePublicProfile: (profile: any | null) => void;
  adminEditNotice: any | null;
  setAdminEditNotice: (notice: any | null) => void;
  adminEditCountdown: any | null;
  setAdminEditCountdown: (countdown: any | null) => void;
`;

uiStore = uiStore.replace('isSidebarCollapsed: boolean;\n  setIsSidebarCollapsed: (collapsed: boolean) => void;\n}', 'isSidebarCollapsed: boolean;\n  setIsSidebarCollapsed: (collapsed: boolean) => void;\n' + interfaceAdditions + '}');

const implAdditions = `
  mockToEdit: undefined,
  setMockToEdit: (mock) => set({ mockToEdit: mock }),
  editingChallenge: null,
  setEditingChallenge: (challenge) => set({ editingChallenge: challenge }),
  activePublicProfile: null,
  setActivePublicProfile: (profile) => set({ activePublicProfile: profile }),
  adminEditNotice: null,
  setAdminEditNotice: (notice) => set({ adminEditNotice: notice }),
  adminEditCountdown: null,
  setAdminEditCountdown: (countdown) => set({ adminEditCountdown: countdown }),
`;
uiStore = uiStore.replace('setIsSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),', 'setIsSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),\n' + implAdditions);
fs.writeFileSync('src/store/uiStore.ts', uiStore);

// 2. Remove from AppContext.tsx
let appContext = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

appContext = appContext.replace(/  activePublicProfile: any;\n  setActivePublicProfile: \(profile: any\) => void;\n  adminEditNotice: any;\n  setAdminEditNotice: \(notice: any\) => void;\n  adminEditCountdown: any;\n  setAdminEditCountdown: \(countdown: any\) => void;\n/g, '');
appContext = appContext.replace(/  mockToEdit: MockScore \| undefined;\n  setMockToEdit: \(mock: MockScore \| undefined\) => void;\n  editingChallenge: any \| null;\n  setEditingChallenge: \(challenge: any \| null\) => void;\n/g, '');
appContext = appContext.replace(/  const \[mockToEdit, setMockToEdit\] = useState<MockScore \| undefined>\(undefined\);\n  const \[activePublicProfile, setActivePublicProfile\] = useState<any>\(null\);\n  const \[adminEditNotice, setAdminEditNotice\] = useState<any>\(null\);\n  const \[adminEditCountdown, setAdminEditCountdown\] = useState<any>\(null\);\n  const \[editingChallenge, setEditingChallenge\] = useState<any>\(null\);\n/g, '');
appContext = appContext.replace(/handleUpdateProfileTasks, mockToEdit, setMockToEdit, editingChallenge, setEditingChallenge,/g, 'handleUpdateProfileTasks,');
appContext = appContext.replace(/    activePublicProfile, setActivePublicProfile,\n    adminEditNotice, setAdminEditNotice,\n    adminEditCountdown, setAdminEditCountdown\n/g, '');
appContext = appContext.replace(/\[mockToEdit, editingChallenge, isOwner, isAdminUser, isAdmin, adminPermissions, localCategory, activePublicProfile, adminEditNotice, adminEditCountdown\]/g, '[isOwner, isAdminUser, isAdmin, adminPermissions, localCategory]');
fs.writeFileSync('src/context/AppContext.tsx', appContext);
