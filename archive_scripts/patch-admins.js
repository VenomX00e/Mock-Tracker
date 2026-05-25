import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

// 1. Update activeTab type
code = code.replace(
  /useState<'users' \| 'liveMock' \| 'notice' \| 'countdown' \| 'challenge' \| 'settings' \| 'categories'>/g,
  "useState<'users' | 'liveMock' | 'notice' | 'countdown' | 'challenge' | 'settings' | 'categories' | 'admins'>"
);

// 2. Add button to Sidebar
const adminsSidebarBtn = `
              {isOwner && (
              <button 
                onClick={() => { setActiveTab('admins'); setAdminCategoryScope(null); }}
                className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors \${activeTab === 'admins' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}\`}
              >
                <Shield className="w-4 h-4" /> Admins Management
              </button>
              )}
`;

code = code.replace(
  /(\{\(isOwner \|\| adminPermissions\?\.canManageUsers\) && \([\s\S]*?<Users className="w-4 h-4" \/> User Management[\s\S]*?<\/button>\s*\)\})/,
  adminsSidebarBtn + "\n              $1"
);


// 3. Add Admins view
const adminsView = `
          {activeTab === 'admins' && isOwner && (
            <div className="space-y-6 max-w-2xl mx-auto pt-6 md:pt-0">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">Admin Management</h3>
              {loading ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">Loading users...</div>
              ) : (
                <div className="space-y-4">
                  {allFirebaseUsers.filter(u => u.role === 'admin').map((adminUser) => (
                    <div key={adminUser.userId} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl relative">
                       <div className="flex justify-between items-start">
                         <div>
                           <p className="font-bold text-slate-900 dark:text-slate-100">{adminUser.displayName || 'No Name'}</p>
                           <p className="text-sm text-slate-500 dark:text-slate-400">{adminUser.email}</p>
                         </div>
                       </div>
                       
                       <div className="mt-4">
                         <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Category Permissions</p>
                         <div className="flex flex-wrap gap-2">
                           {categories.map(cat => {
                              const isSelected = (adminUser as any).adminCategories?.includes(cat.id);
                              return (
                                <label key={cat.id} className={\`text-xs flex items-center justify-center font-medium px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors border select-none \${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}\`}>
                                  <input 
                                     type="checkbox" 
                                     className="hidden" 
                                     checked={!!isSelected}
                                     onChange={async (e) => {
                                       const checked = e.target.checked;
                                       const currentCats = (adminUser as any).adminCategories || [];
                                       const newCats = checked ? [...currentCats, cat.id] : currentCats.filter((id: string) => id !== cat.id);
                                       const { doc, setDoc } = await import('firebase/firestore');
                                       const { db } = await import('../services/firebase');
                                       await setDoc(doc(db, 'users', adminUser.userId), { adminCategories: newCats }, { merge: true });
                                       setAllFirebaseUsers(prev => prev.map(u => u.userId === adminUser.userId ? {...u, adminCategories: newCats} : u));
                                     }}
                                  />
                                  {cat.name}
                                </label>
                              );
                           })}
                         </div>
                         <p className="text-[10px] text-slate-400 mt-2">If no categories are selected, to them admin panel is not visible in any category.</p>
                       </div>
                    </div>
                  ))}
                  {allFirebaseUsers.filter(u => u.role === 'admin').length === 0 && (
                    <p className="text-sm text-slate-500 italic">No admins found. Add admins from the User Management tab first.</p>
                  )}
                </div>
              )}
            </div>
          )}
`;

code = code.replace(
  /(\{\s*activeTab === 'users' &&)/,
  adminsView + "\n          $1"
);

fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log("Patched Admins Tab!");
