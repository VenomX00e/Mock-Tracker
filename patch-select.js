import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

const target = `{isOwner && (
                                      <select
                                        value={user.role || "user"}
                                        onChange={(e) =>
                                          handleUpdateUserRole(
                                            user.userId,
                                            e.target.value,
                                          )
                                        }
                                        className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 outline-none text-slate-700 dark:text-slate-300"
                                      >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                      </select>
                                    )}`;

const replacement = `{isOwner && (
                                      <CustomDropdown
                                        value={user.role === 'admin' ? 'Admin' : 'User'}
                                        options={['User', 'Admin']}
                                        onChange={(val) => handleUpdateUserRole(user.userId, val.toLowerCase())}
                                        placeholder="Role"
                                        buttonClassName="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold h-[26px] flex items-center justify-between"
                                        optionClassName="px-2 py-1 text-[11px]"
                                        className="w-[85px]"
                                      />
                                    )}`;

code = code.split(target).join(replacement);
fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log("Patched!!");
