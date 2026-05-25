const fs = require('fs');

const updateFile = (path, replaceFn) => {
  if (fs.existsSync(path)) {
     const str = fs.readFileSync(path, 'utf-8');
     fs.writeFileSync(path, replaceFn(str));
  }
};

updateFile('src/components/views/CountdownsSection.tsx', (c) => {
  let nc = c.replace(/setAdminEditCountdown, /g, '');
  nc = nc.replace(
    'const { isAdmin } = useAppStateCtx();',
    'const { isAdmin, setAdminEditCountdown } = useAppStateCtx();'
  );
  if (!nc.includes('useAppStateCtx')) {
      nc = nc.replace('import { useUIStore }', 'import { useAppStateCtx } from "../../context/AppContext";\nimport { useUIStore }');
      nc = nc.replace('const { activeTab, ', 'const { setAdminEditCountdown } = useAppStateCtx();\n  const { activeTab, ');
  }
  return nc;
});

updateFile('src/components/views/CountdownsPage.tsx', (c) => {
  let nc = c.replace(/setAdminEditCountdown, /g, '');
  nc = nc.replace(
    'const { adminPermissions, isOwner } = useAppStateCtx();',
    'const { adminPermissions, isOwner, setAdminEditCountdown } = useAppStateCtx();'
  );
  return nc;
});

// For ModalsSection.tsx
updateFile('src/components/views/ModalsSection.tsx', (c) => {
  return c.replace(
    /const \{ setMockToEdit,/g,
    'const { activePublicProfile, setActivePublicProfile, adminEditNotice, setAdminEditNotice, adminEditCountdown, setAdminEditCountdown, setMockToEdit,'
  );
});

// We deleted handleReact, handleAdminRestore, handleAdminPermanentDelete from CommunityHub!
// Wait where were they? Let's reconstruct them.
