const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

const t1 = `                      })
                      .map((user) => (`
const r1 = `                      })
                      .slice(0, 100).map((user) => (`

const t2 = `                            })
                            .map((user) => (`
const r2 = `                            })
                            .slice(0, 100).map((user) => (`

const t3 = `                           {bannedUsers.map((user) => (`
const r3 = `                           {bannedUsers.slice(0, 100).map((user) => (`

const t4 = `                            )
                            .map((user) => (`
const r4 = `                            )
                            .slice(0, 100).map((user) => (`

code = code.replace(t1, r1);
code = code.replace(t2, r2);
code = code.replace(t3, r3);
code = code.replace(t4, r4);

fs.writeFileSync('src/components/AdminDialog.tsx', code);
