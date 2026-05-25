import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

const target1 = `  const [loading, setLoading] = useState(false);`;
const replacement1 = `  const [loading, setLoading] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");`;

code = code.replace(target1, replacement1);

const adminManagementTarget = `<div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                  Admin Management
                </h3>
                {categories.length > 0 && (
                  <CustomDropdown`;

const adminManagementReplacement = `<div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 gap-3 sm:gap-0">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                  Admin Management
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search admins..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-[160px]"
                    />
                  </div>
                {categories.length > 0 && (
                  <CustomDropdown`;

code = code.replace(adminManagementTarget, adminManagementReplacement);

const adminDropdownEndTarget = `optionClassName="px-2.5 py-1.5 text-xs"
                    menuDirection="bottom"
                  />
                )}
              </div>
              {loading ? (`;

const adminDropdownEndReplacement = `optionClassName="px-2.5 py-1.5 text-xs"
                    menuDirection="bottom"
                  />
                )}
                </div>
              </div>
              {loading ? (`;

code = code.replace(adminDropdownEndTarget, adminDropdownEndReplacement);

const adminFilterTarget = `adminManagementCategoryFilter,
                        ),
                    )`;
const adminFilterReplacement = `adminManagementCategoryFilter,
                        ),
                    )
                    .filter(u => adminSearch.trim() === "" || u.email?.toLowerCase().includes(adminSearch.toLowerCase()) || (u as any).displayName?.toLowerCase().includes(adminSearch.toLowerCase()))`;
code = code.replace(adminFilterTarget, adminFilterReplacement);

const adminFilter2Target = `adminManagementCategoryFilter,
                        ),
                    ).length === 0 && (`;
const adminFilter2Replacement = `adminManagementCategoryFilter,
                        ),
                    ).filter(u => adminSearch.trim() === "" || u.email?.toLowerCase().includes(adminSearch.toLowerCase()) || (u as any).displayName?.toLowerCase().includes(adminSearch.toLowerCase())).length === 0 && (`;
code = code.replace(adminFilter2Target, adminFilter2Replacement);


const userManagementTarget = `<h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">
                  User Management
                </h3>`;

const userManagementReplacement = `<div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 gap-3 sm:gap-0">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                  User Management
                </h3>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-[200px]"
                    />
                  </div>
</div>`;
code = code.replace(userManagementTarget, userManagementReplacement);

const userFilterTarget = `=== u.email)),
                              )
                            .map((user) => (`;
const userFilterReplacement = `=== u.email)),
                              )
                            .filter(u => userSearch.trim() === "" || u.email?.toLowerCase().includes(userSearch.toLowerCase()) || (u as any).displayName?.toLowerCase().includes(userSearch.toLowerCase()))
                            .map((user) => (`;
code = code.replace(userFilterTarget, userFilterReplacement);

const userFilter2Target = `=== u.email)),
                            ).length === 0 ? (`;
const userFilter2Replacement = `=== u.email)),
                            ).filter(u => userSearch.trim() === "" || u.email?.toLowerCase().includes(userSearch.toLowerCase()) || (u as any).displayName?.toLowerCase().includes(userSearch.toLowerCase())).length === 0 ? (`;
code = code.replace(userFilter2Target, userFilter2Replacement);


if (!code.includes('import { Search')) {
  // Try to find lucide-react imports
  const lucideRegex = /import\s+\{([^}]+)\}\s+from\s+["']lucide-react["']/;
  const match = code.match(lucideRegex);
  if (match) {
    if (!match[1].includes('Search')) {
       const newImports = match[1] + ", Search";
       code = code.replace(match[1], newImports);
    }
  }
}

fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log("Patched!!");
