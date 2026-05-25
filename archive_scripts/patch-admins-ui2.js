import fs from 'fs';

let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

// The Admins UI is currently rendered as a <div key={adminUser.userId} ...> inside {activeTab === 'admins' ...}
// Let's replace the whole {activeTab === "admins" ...} block with a new one that maps using the <li ...> template from User Management.

const adminBlockStartIdx = code.indexOf('{activeTab === "admins" && isOwner && (');
const userBlockStartIdx = code.indexOf('{activeTab === "users" &&');

if (adminBlockStartIdx === -1 || userBlockStartIdx === -1) {
    console.error("Could not find admin tab or user tab block!");
    process.exit(1);
}

// Find the <li> block we want to replicate
const userListMapIndex = code.indexOf('.map((user) => (', userBlockStartIdx);
if (userListMapIndex === -1) {
    console.error("Could not find map block");
    process.exit(1);
}

const liStart = code.indexOf('<li', userListMapIndex);
let bracketCount = 0;
let liEnd = -1;

// This will just grab up to line 2181 we found manually inside the view_file ...
// To be safe let's extract by string matching
// We know it ends with `</li>` and then `))` and `</ul>`
for (let i = liStart; i < code.length; i++) {
    const chunk = code.substring(i, i + 5);
    if (chunk === '</li>') {
        const afterChunk = code.substring(i + 5, i + 50);
        if (afterChunk.includes('))}')) {
            liEnd = i + 5;
            break;
        }
    }
}

if (liEnd === -1) {
    console.error("Could not find liEnd!");
    process.exit(1);
}

let liBlock = code.substring(liStart, liEnd);

// Add Category Permissions block
const adminPermRegex = /<label[\s\S]*?\{\(user\.permissions as any\)[\s\S]*?\}[\s\S]*?\{perm\.replace\("canManage", ""\)\}[\s\S]*?<\/label>\s*\)\)}\s*<\/div>\s*<\/div>\s*\)\}/;

const categoryPermissionsBlock = `
                                    {isOwner &&
                                      user.role === "admin" &&
                                      expandedAdminId === user.userId && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/50 w-full animate-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
                                          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Category Permissions</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {categories.map((cat) => {
                                              const isSelected = (user as any).adminCategories?.includes(cat.id);
                                              return (
                                                <label
                                                  key={cat.id}
                                                  className={\`text-[10px] flex items-center justify-center font-medium px-2 py-1 rounded-md cursor-pointer transition-colors border select-none \${isSelected ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300" : "bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}\`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={!!isSelected}
                                                    onChange={async (e) => {
                                                      const checked = e.target.checked;
                                                      const currentCats = (user as any).adminCategories || [];
                                                      const newCats = checked ? [...currentCats, cat.id] : currentCats.filter((id: string) => id !== cat.id);
                                                      const { doc, setDoc } = await import("firebase/firestore");
                                                      const { db } = await import("../services/firebase");
                                                      await setDoc(doc(db, "users", user.userId), { adminCategories: newCats }, { merge: true });
                                                      setAllFirebaseUsers((prev) => prev.map((u) => u.userId === user.userId ? { ...u, adminCategories: newCats } : u));
                                                    }}
                                                  />
                                                  {cat.name}
                                                </label>
                                              );
                                            })}
                                          </div>
                                          <p className="text-[10px] text-slate-400 mt-2">If no categories are selected, to them admin panel is not visible in any category.</p>
                                        </div>
                                    )}
`;

liBlock = liBlock.replace(adminPermRegex, (match) => match + categoryPermissionsBlock);

const newAdminTab = `{activeTab === "admins" && isOwner && (
            <div className="space-y-6 max-w-2xl mx-auto pt-6 md:pt-0">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">
                Admin Management
              </h3>
              {loading ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                  Loading users...
                </div>
              ) : (
                <div className="space-y-4">
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg max-h-[500px] overflow-y-auto w-full relative">
                  {allFirebaseUsers
                    .filter((u) => u.role === "admin")
                    .map((user) => (
                      ${liBlock}
                    ))}
                  </ul>
                  {allFirebaseUsers.filter((u) => u.role === "admin").length ===
                    0 && (
                    <p className="text-sm text-slate-500 italic">
                      No admins found. Add admins from the User Management tab
                      first.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "users" &&`;

const adminBlockString = code.substring(adminBlockStartIdx, userBlockStartIdx + '{activeTab === "users" &&'.length);
code = code.replace(adminBlockString, newAdminTab);


// Modify the filtering to not check 'admins' when rendering lists inside `activeTab === 'users'`
// We need to replace all instances of `(userFilter === "admins" ? allFirebaseUsers.filter((u) => u.role === "admin") : userFilter === "all"` inside the user rendering.
code = code.replace(/\(userFilter === "admins"\s*\?\s*allFirebaseUsers\.filter\(\(u\) => u\.role === "admin"\)\s*:\s*userFilter === "all"/g, '(userFilter === "all"');

// And remove the button:
const adminsFilterButtonRegex = /<button\s*onClick=\{\(\) => setUserFilter\("admins"\)\}[\s\S]*?<\/button>/;
code = code.replace(adminsFilterButtonRegex, "");

fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log("Patched successfully!");
