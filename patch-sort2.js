import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

const target1 = `                      .sort((a, b) => {
                        const search = adminSearch.toLowerCase().trim();
                        const nameA = ((a as any).displayName || a.email || "").toLowerCase();
                        const nameB = ((b as any).displayName || b.email || "").toLowerCase();
                        if (search) {
                          const aStarts = nameA.startsWith(search) ? 1 : 0;
                          const bStarts = nameB.startsWith(search) ? 1 : 0;
                          if (aStarts !== bStarts) return bStarts - aStarts;
                        }
                        return nameA.localeCompare(nameB);
                      })`;

const replacement1 = `                      .sort((a, b) => {
                        const search = adminSearch.toLowerCase().trim();
                        const nameA = ((a as any).displayName || a.email || "").toLowerCase();
                        const nameB = ((b as any).displayName || b.email || "").toLowerCase();
                        if (search) {
                          const aStarts = nameA.startsWith(search) ? 1 : 0;
                          const bStarts = nameB.startsWith(search) ? 1 : 0;
                          if (aStarts !== bStarts) return bStarts - aStarts;
                          return nameA.localeCompare(nameB);
                        }
                        
                        const getMs = (val: any) => {
                          if (!val) return 0;
                          if (typeof val === 'number') return val;
                          if (val.toMillis) return val.toMillis();
                          if (val.seconds) return val.seconds * 1000;
                          return new Date(val).getTime() || 0;
                        };
                        
                        const aJoined = getMs((a as any).createdAt);
                        const bJoined = getMs((b as any).createdAt);
                        if (aJoined !== bJoined) return bJoined - aJoined;
                        
                        const aActive = getMs(a.lastActiveAt);
                        const bActive = getMs(b.lastActiveAt);
                        return bActive - aActive;
                      })`;

const target2 = `                            .sort((a, b) => {
                              const search = userSearch.toLowerCase().trim();
                              const nameA = ((a as any).displayName || a.email || "").toLowerCase();
                              const nameB = ((b as any).displayName || b.email || "").toLowerCase();
                              if (search) {
                                const aStarts = nameA.startsWith(search) ? 1 : 0;
                                const bStarts = nameB.startsWith(search) ? 1 : 0;
                                if (aStarts !== bStarts) return bStarts - aStarts;
                              }
                              return nameA.localeCompare(nameB);
                            })`;

const replacement2 = `                            .sort((a, b) => {
                              const search = userSearch.toLowerCase().trim();
                              const nameA = ((a as any).displayName || a.email || "").toLowerCase();
                              const nameB = ((b as any).displayName || b.email || "").toLowerCase();
                              if (search) {
                                const aStarts = nameA.startsWith(search) ? 1 : 0;
                                const bStarts = nameB.startsWith(search) ? 1 : 0;
                                if (aStarts !== bStarts) return bStarts - aStarts;
                                return nameA.localeCompare(nameB);
                              }
                              
                              const getMs = (val: any) => {
                                if (!val) return 0;
                                if (typeof val === 'number') return val;
                                if (val.toMillis) return val.toMillis();
                                if (val.seconds) return val.seconds * 1000;
                                return new Date(val).getTime() || 0;
                              };
                              
                              const aJoined = getMs((a as any).createdAt);
                              const bJoined = getMs((b as any).createdAt);
                              if (aJoined !== bJoined) return bJoined - aJoined;
                              
                              const aActive = getMs(a.lastActiveAt);
                              const bActive = getMs(b.lastActiveAt);
                              return bActive - aActive;
                            })`;

code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log('patched');
