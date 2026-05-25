import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

code = code.replace(
  /setAdminCategoryScope\(null\)/g,
  "setAdminCategoryScope(isForcedCategory ? (currentCategory || null) : null)"
);

fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log("Patched setAdminCategoryScope");
