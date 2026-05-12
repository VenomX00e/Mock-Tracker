import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

const adminListTarget = `                    {allFirebaseUsers
                      .filter((u) => u.role === "admin")
                      .filter(
                        (u) =>
                          adminManagementCategoryFilter === "all" ||
                          (u as any).adminCategories?.includes(
                            adminManagementCategoryFilter,
                          ),
                      )
                      .map((user) => (`

const adminListReplacement = `                    {[...allFirebaseUsers]
                      .filter((u) => u.role === "admin")
                      .filter(
                        (u) =>
                          adminManagementCategoryFilter === "all" ||
                          (u as any).adminCategories?.includes(
                            adminManagementCategoryFilter,
                          ),
                      )
                      .filter(
                        (u) =>
                          adminSearch.trim() === "" ||
                          u.email
                            ?.toLowerCase()
                            .includes(adminSearch.toLowerCase()) ||
                          (u as any).displayName
                            ?.toLowerCase()
                            .includes(adminSearch.toLowerCase())
                      )
                      .sort((a, b) => {
                        const search = adminSearch.toLowerCase().trim();
                        const nameA = ((a as any).displayName || a.email || "").toLowerCase();
                        const nameB = ((b as any).displayName || b.email || "").toLowerCase();
                        if (search) {
                          const aStarts = nameA.startsWith(search) ? 1 : 0;
                          const bStarts = nameB.startsWith(search) ? 1 : 0;
                          if (aStarts !== bStarts) return bStarts - aStarts;
                        }
                        return nameA.localeCompare(nameB);
                      })
                      .map((user) => (`

code = code.replace(adminListTarget, adminListReplacement);

const userListTarget = `                          {(userFilter === "all"
                            ? allFirebaseUsers
                            : allAppUsers
                          )
                            .filter(
                              (u) =>
                                isOwner ||
                                u.email !== "mrityunjoyk29@gmail.com",
                            )
                            .map((user) => (`

const userListReplacement = `                          {[...(userFilter === "all"
                            ? allFirebaseUsers
                            : allAppUsers
                          )]
                            .filter(
                              (u) =>
                                isOwner ||
                                u.email !== "mrityunjoyk29@gmail.com",
                            )
                            .filter(u => userSearch.trim() === "" || u.email?.toLowerCase().includes(userSearch.toLowerCase()) || (u as any).displayName?.toLowerCase().includes(userSearch.toLowerCase()))
                            .sort((a, b) => {
                              const search = userSearch.toLowerCase().trim();
                              const nameA = ((a as any).displayName || a.email || "").toLowerCase();
                              const nameB = ((b as any).displayName || b.email || "").toLowerCase();
                              if (search) {
                                const aStarts = nameA.startsWith(search) ? 1 : 0;
                                const bStarts = nameB.startsWith(search) ? 1 : 0;
                                if (aStarts !== bStarts) return bStarts - aStarts;
                              }
                              return nameA.localeCompare(nameB);
                            })
                            .map((user) => (`

code = code.replace(userListTarget, userListReplacement);
fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log("Patched!!");
