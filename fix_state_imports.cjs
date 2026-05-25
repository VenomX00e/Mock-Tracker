const fs = require('fs');

const updateFile = (path, replaceFn) => {
  if (fs.existsSync(path)) {
     const str = fs.readFileSync(path, 'utf-8');
     fs.writeFileSync(path, replaceFn(str));
  }
};

updateFile('src/components/Navigation.tsx', (c) => {
  let nc = c.replace(/setAdminEditNotice, /g, '');
  nc = nc.replace(/setAdminEditCountdown, /g, '');
  if (nc.includes('setAdminEditNotice')) return nc; // already done
  return nc.replace(
    'const { adminPermissions, isOwner, setLocalCategory } = useAppStateCtx();',
    'const { adminPermissions, isOwner, setLocalCategory, setAdminEditNotice, setAdminEditCountdown } = useAppStateCtx();'
  );
});

updateFile('src/components/Sidebar.tsx', (c) => {
  let nc = c.replace(/setAdminEditNotice, /g, '');
  nc = nc.replace(/setAdminEditCountdown, /g, '');
  return nc.replace(
    'const { isAdmin } = useAppStateCtx();',
    'const { isAdmin, setAdminEditNotice, setAdminEditCountdown } = useAppStateCtx();'
  );
});

updateFile('src/components/views/CountdownsPage.tsx', (c) => {
  let nc = c.replace(/setAdminEditCountdown/g, '');
  // Because it was setAdminEditCountdown from useUIStore, we need to extract from AppState instead.
  return nc.replace(
    /const \{ adminPermissions, isOwner \} = useAppStateCtx\(\);/g,
    'const { adminPermissions, isOwner, setAdminEditCountdown } = useAppStateCtx();'
  );
});

updateFile('src/components/views/CountdownsSection.tsx', (c) => {
  let nc = c.replace(/setAdminEditCountdown, /g, '');
  if (!nc.includes('useAppStateCtx')) {
    nc = nc.replace(/import \{ useUIStore \} from '\.\.\/store\/uiStore';/, 'import { useUIStore } from \'../store/uiStore\';\nimport { useAppStateCtx } from \'../../context/AppContext\';');
    nc = nc.replace('const { isAdminUser } = AppStateCtx;', 'const { isAdmin } = useAppStateCtx();'); // Wait let me just match useUIStore
    nc = nc.replace(/const \{ setIsAdminModalOpen, adminTab, setAdminTab \} = useUIStore\(\);/g, 'const { setIsAdminModalOpen, adminTab, setAdminTab } = useUIStore();\n  const { setAdminEditCountdown } = useAppStateCtx();');
  }
  return nc;
});
