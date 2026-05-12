import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

// Update Props
code = code.replace(
  /categories: ExamCategory\[\];/,
  "categories: ExamCategory[];\n  currentCategory?: string | null;"
);

// Update component signature
code = code.replace(
  /export default function AdminDialog\(\{ isOpen, onClose, isOwner, adminPermissions, initialTab = 'users', editNoticeData = null, editCountdownData = null, asPage = false, categories \}: AdminDialogProps\) \{/,
  "export default function AdminDialog({ isOpen, onClose, isOwner, adminPermissions, initialTab = 'users', editNoticeData = null, editCountdownData = null, asPage = false, categories, currentCategory = null }: AdminDialogProps) {"
);

// Update useState for adminCategoryScope
code = code.replace(
  /const \[adminCategoryScope, setAdminCategoryScope\] = useState<string \| null>\(null\);/,
  "const [adminCategoryScope, setAdminCategoryScope] = useState<string | null>((!isOwner && currentCategory) ? currentCategory : null);\n  const isForcedCategory = !isOwner && currentCategory !== null;"
);

// We need to hide the "Back to {adminCategoryScope}" button if isForcedCategory
code = code.replace(
  /\{adminCategoryScope && isOwner && \(/,
  "{adminCategoryScope && isOwner && !isForcedCategory && ("
);

// We also need to hide the settings button if they are not owner? 
// No, adminPermissions.canManageSettings is checked.

// In App.tsx, we need to pass currentCategory
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(
  /<AdminDialog\s+isOpen=\{true\}\s+isOwner=\{isOwner\}\s+adminPermissions=\{adminPermissions\}/g,
  "<AdminDialog\n                      isOpen={true}\n                      isOwner={isOwner}\n                      adminPermissions={adminPermissions}\n                      currentCategory={selectedCategory}"
);

appCode = appCode.replace(
  /<AdminDialog \s+isOpen=\{isAdminModalOpen\}\s+isOwner=\{isOwner\}\s+adminPermissions=\{adminPermissions\}/g,
  "<AdminDialog \n          isOpen={isAdminModalOpen}\n          isOwner={isOwner}\n          adminPermissions={adminPermissions}\n          currentCategory={selectedCategory}"
);

fs.writeFileSync('src/components/AdminDialog.tsx', code);
fs.writeFileSync('src/App.tsx', appCode);
console.log("Patched component and App.tsx");
