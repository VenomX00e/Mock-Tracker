import fs from 'fs';

let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

// The Admins UI is currently rendered as a <div key={adminUser.userId} ...> inside {activeTab === 'admins' ...}
// Let's replace the whole {activeTab === "admins" ...} block with a new one that maps using the <li ...> template from User Management.

// 1. First, we need to locate the `activeTab === 'admins'` block and `activeTab === 'users'` block, but it's simpler to do a replace on the entire block.
const adminBlockRegex = /\{activeTab === "admins" && isOwner && \([\s\S]*?\{activeTab === "users"/;

let adminMatch = code.match(adminBlockRegex);

if (!adminMatch) {
    console.error("Could not find admin tab block!");
    process.exit(1);
}

const listRenderRegex = /<ul className="divide-y divide-slate-100 dark:divide-slate-800\/50 border border-slate-200 dark:border-slate-800\/50 rounded-lg max-h-60 overflow-y-auto w-full relative">[\s\S]*?\{\(userFilter === "admins"[\s\S]*?\.map\(\(user\) => \(([\s\S]*?)<\/li>\n                            \)\)\n                          <\/ul>/;

let userListMatch = code.match(listRenderRegex);
if (!userListMatch) {
    console.error("Could not find user list render block!");
    process.exit(1);
}

// Extract the <li> block
let liBlock = userListMatch[1] + "</li>";

// In the li block, we need to add the Category Permissions to it, replacing the old category loop inside `activeTab === 'admins'`.
// The admins tab iteration previously used `adminUser` but the liBlock uses `user`. We will just use `user`.

// Find the spot to insert Category Permissions. The best spot is directly after the "Admin Permissions" block inside the liBlock.
const adminPermissionsBlock = /<label[\s\S]*?\{\(user\.permissions as any\)\?\.\[[\s\S]*?perm[\s\S]*?\][\s\S]*?\}[\s\S]*?\{perm.replace\("canManage", ""\)\}[\s\S]*?<\/label>\n                                          \)\)}\n                                        <\/div>\n                                      <\/div>\n                                    \)}/;

const categoryPermissionsBlock = `
                                    {isOwner &&
                                      user.role === "admin" &&
                                      expandedAdminId === user.userId && (
                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/50 w-full animate-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
                                          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Category Permissions</p>
                                          <div className="flex flex-wrap gap-2">
                                            {categories.map((cat) => {
                                              const isSelected = (user as any).adminCategories?.includes(cat.id);
                                              return (
                                                <label
                                                  key={cat.id}
                                                  className={\`text-xs flex items-center justify-center font-medium px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors border select-none \${isSelected ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300" : "bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}\`}
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

liBlock = liBlock.replace(adminPermissionsBlock, (match) => match + categoryPermissionsBlock);

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
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg max-h-60 overflow-y-auto w-full relative">
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

          {activeTab === "users"`;

code = code.replace(adminBlockRegex, newAdminTab);

// 2. Remove the "Admins" filter from "User Management" tab.
// Find the <button ... > Admins (... length) </button> inside `userFilter`
const adminsFilterButtonRegex = /<button\s*onClick=\{\(\) => setUserFilter\("admins"\)\}[\s\S]*?<\/button>/;
code = code.replace(adminsFilterButtonRegex, "");

// Modify the filtering to not check 'admins' when rendering lists inside `activeTab === 'users'`
// userFilter === "admins" ? allFirebaseUsers.filter((u) => u.role === "admin") : userFilter === "all" ? allFirebaseUsers : allAppUsers
code = code.replace(/\(userFilter === "admins"[\s\S]*?userFilter === "all"/g, '(userFilter === "all"');

fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log("Patched successfully!");
