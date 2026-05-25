const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

// 1. Remove getSub definition
const getSubRegex = /  const getSub = \(mock: any, id: string\) => \{[^}]*if[^}]*if[^}]*if[^}]*if[^}]*if[^}]*if[^}]*if[^}]*\n    \}\n    return null;\n  \};\n/;
content = content.replace(getSubRegex, '');

// 2. Remove getSubjectColor definition(s)
const getSubjectColorRegex1 = /                    const getSubjectColor = \(subjectId: string\) => \{[\s\S]*?return '#6366f1';\n                    \};\n/g;
content = content.replace(getSubjectColorRegex1, '');

const getSubjectColorRegex2 = /                         const getSubjectColor = \(subjectId: string\) => \{[\s\S]*?return '#6366f1';\n                         \};\n/g;
content = content.replace(getSubjectColorRegex2, '');

// 3. Add import
if (!content.includes('import { getSub, getSubjectColor }')) {
  content = content.replace(
    /import \{ getHeatmapColor, getPlatformShort, parseLocalDate \} from '\.\.\/lib\/utils';/,
    "import { getHeatmapColor, getPlatformShort, parseLocalDate } from '../lib/utils';\nimport { getSub, getSubjectColor } from '../lib/subjectUtils';"
  );
}

// 4. Replace getSub(a, b) with getSub(a, b, subjects) - we have to be careful with the TooltipComponent that receives it as a prop.
// Actually, `getSub` is passed to `<CustomTooltip chartRefBox={...} getSub={getSub} />`. 
// If we change it to `<CustomTooltip chartRefBox={...} getSub={(m, id) => getSub(m, id, subjects)} />`
content = content.replace(/getSub=\{getSub\}/g, "getSub={(m, id) => getSub(m, id, subjects)}");

// also there are direct calls like getSub(m, s.id)
// we replace `getSub(` with `getSub(` but wait, if it's already `getSub(a, b, subjects)` we skip.
// Let's use a replacer:
content = content.replace(/getSub\(([^,]+),\s*([^),]+)\)/g, "getSub($1, $2, subjects)");

// wait, the replacer above would do `getSub(m, id, subjects, subjects)` if run twice. I'll just write a cleaner regex
content = content.replace(/getSub\(([^,]+),\s*([^),]+)\)/g, (match, p1, p2) => {
  if (p2.trim() === 'subjects') return match; // fallback
  return `getSub(${p1}, ${p2}, subjects)`;
});

// what about getSubjectColor?
content = content.replace(/getSubjectColor\(([^)]+)\)/g, (match, p1) => {
  if (p1.includes('subjects')) return match;
  return `getSubjectColor(${p1}, subjects)`;
});

// also fix handleExportExcel which takes getSub.
content = content.replace(/handleExportExcel\(displayedMocks, subjects, getSub\)/g, "handleExportExcel(displayedMocks, subjects, (m, id) => getSub(m, id, subjects))");

fs.writeFileSync('src/components/Dashboard.tsx', content);

// check CommunityHub.tsx
let hub = fs.readFileSync('src/components/CommunityHub.tsx', 'utf-8');
if (hub.includes('const getSub =')) {
   hub = hub.replace(/  const getSub = \(mock: any, id: string\) => \{[\s\S]*?return null;\n  };\n/, '');
   if (!hub.includes('import { getSub }')) {
     hub = hub.replace(/import \{ Trophy, User, Calendar, BookOpen, Crown \} from 'lucide-react';/, "import { Trophy, User, Calendar, BookOpen, Crown } from 'lucide-react';\nimport { getSub } from '../lib/subjectUtils';");
   }
   hub = hub.replace(/getSub\(([^,]+),\s*([^),]+)\)/g, (match, p1, p2) => {
      if (p2.trim() === 'subjects') return match;
      return `getSub(${p1}, ${p2}, subjects)`;
   });
   fs.writeFileSync('src/components/CommunityHub.tsx', hub);
}
