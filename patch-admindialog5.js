import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

code = code.replace(
  /<button\s+onClick=\{\(\) => setActiveTab\('categories'\)\}\s+className=\{`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all duration-200 z-10 border \$\{/g,
  "{isOwner && (\n            <button\n              onClick={() => setActiveTab('categories')}\n              className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all duration-200 z-10 border ${"
);

code = code.replace(
  /<span>Exam Categories<\/span>\n\s*<\/button>/g,
  "<span>Exam Categories</span>\n            </button>\n            )}"
);

fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log("Patched top nav");
