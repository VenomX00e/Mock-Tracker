const fs = require('fs');

let modals = fs.readFileSync('src/components/views/ModalsSection.tsx', 'utf-8');
modals = modals.replace(/      adminEditNotice, setAdminEditNotice,\n/g, '');
modals = modals.replace(/      adminEditCountdown, setAdminEditCountdown,\n/g, '');
modals = modals.replace(/const \{ setMockToEdit, editingChallenge, setEditingChallenge, isOwner, activePublicProfile, setActivePublicProfile \} = useAppStateCtx\(\);/g, 'const { setMockToEdit, editingChallenge, setEditingChallenge, isOwner, activePublicProfile, setActivePublicProfile, adminEditNotice, setAdminEditNotice, adminEditCountdown, setAdminEditCountdown } = useAppStateCtx();');
fs.writeFileSync('src/components/views/ModalsSection.tsx', modals);

let vm = fs.readFileSync('src/components/ViewManager.tsx', 'utf-8');
vm = vm.replace(/adminEditNotice, adminEditCountdown, /g, '');
if (!vm.includes('adminEditNotice')) {
   vm = vm.replace(
      'const { isAdmin } = useAppStateCtx();',
      'const { isAdmin, adminEditNotice, adminEditCountdown } = useAppStateCtx();'
   );
}
fs.writeFileSync('src/components/ViewManager.tsx', vm);

let app = fs.readFileSync('src/App.tsx', 'utf-8');
app = app.replace(/adminEditNotice, adminEditCountdown, /g, '');
if (!app.includes('adminEditNotice')) {
   // Wait, let's see what is imported in App.tsx
   app = app.replace(
      'const { profile } = useUserProfileCtx();',
      'const { profile } = useUserProfileCtx();\n  const { adminEditNotice, adminEditCountdown } = useAppStateCtx();'
   );
}
fs.writeFileSync('src/App.tsx', app);
