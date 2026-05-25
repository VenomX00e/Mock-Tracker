import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

const adminEmptyTarget = `                  {allFirebaseUsers
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
                          .includes(adminSearch.toLowerCase()),
                    ).length === 0 && (
                    <p className="text-sm text-slate-500 italic">
                      No admins found. Add admins from the User Management tab
                      first.
                    </p>
                  )}`;

// Ensure the same logic is exactly correct. Oh wait, my patch regex doesn't need to change Admin if it's already correct. Let me check if it's correct.
// Actually, earlier I wrote `adminSearch.trim() === "" || u.email?.toLowerCase().includes...` which seems correct.

// Let's check User empty message
const userEmptyTarget = `                      {(userFilter === "all"
                        ? allFirebaseUsers
                        : allAppUsers
                      ).filter(
                        (u) => isOwner || u.email !== "mrityunjoyk29@gmail.com",
                      ).length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                          No users found.
                        </p>
                      ) : (`;

const userEmptyReplacement = `                      {(userFilter === "all"
                        ? allFirebaseUsers
                        : allAppUsers
                      ).filter(
                        (u) => isOwner || u.email !== "mrityunjoyk29@gmail.com",
                      ).filter(u => userSearch.trim() === "" || u.email?.toLowerCase().includes(userSearch.toLowerCase()) || (u as any).displayName?.toLowerCase().includes(userSearch.toLowerCase())).length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                          No users found.
                        </p>
                      ) : (`;

code = code.replace(userEmptyTarget, userEmptyReplacement);

fs.writeFileSync('src/components/AdminDialog.tsx', code);
