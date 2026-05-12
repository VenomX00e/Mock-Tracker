import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

const targetSectionRegex = /<div className="flex flex-wrap gap-1\.5 w-full">([\s\S]*?)\{\[\s*"canManageUsers",([\s\S]*?)<\/label>\s*\)\)}\s*<\/div>/;

let match = code.match(targetSectionRegex);

if (!match) {
    console.error("Match failed!");
    process.exit(1);
}

const categoryBlock = `
                                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2 mt-4">Category Permissions</p>
                                      <div className="flex flex-wrap gap-1.5 w-full">
                                        {categories.map((cat) => {
                                          const isSelected = (user as any).adminCategories?.includes(cat.id);
                                          return (
                                            <label
                                              key={cat.id}
                                              className={\`text-[10px] flex items-center justify-center font-medium px-2 py-1 rounded-md cursor-pointer transition-colors border select-none \${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}\`}
                                            >
                                              <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={!!isSelected}
                                                onChange={async (e) => {
                                                  const checked = e.target.checked;
                                                  const currentCats = (user as any).adminCategories || [];
                                                  const newCats = checked ? [...currentCats, cat.id] : currentCats.filter((id) => id !== cat.id);
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
`;

code = code.replace(targetSectionRegex, match[0] + categoryBlock);

fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log("Patched!!");
