import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

code = code.replace(
  /\{activeTab === 'liveMock' && !adminCategoryScope &&/g,
  "{activeTab === 'liveMock' && (!adminCategoryScope || isForcedCategory) &&"
);

code = code.replace(
  /\{activeTab === 'countdown' && !adminCategoryScope &&/g,
  "{activeTab === 'countdown' && (!adminCategoryScope || isForcedCategory) &&"
);

code = code.replace(
  /\{activeTab === 'notice' && !adminCategoryScope &&/g,
  "{activeTab === 'notice' && (!adminCategoryScope || isForcedCategory) &&"
);

code = code.replace(
  /\{activeTab === 'challenge' && !adminCategoryScope &&/g,
  "{activeTab === 'challenge' && (!adminCategoryScope || isForcedCategory) &&"
);

fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log("Patched rendering logic for forced category admins");
