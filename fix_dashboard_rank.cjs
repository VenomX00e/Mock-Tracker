const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

const regex = /  const \[leaderboardRank, setLeaderboardRank\] \= useState<number \| null>\(null\);[\s\S]*?fetchRank\(\);\n  \}, \[profile\?\.userId, activeCategory\?\.id\]\);/;

content = content.replace(regex, `  const leaderboardRank = useLeaderboardRank(profile, activeCategory?.id);`);

if (!content.includes('import { useLeaderboardRank }')) {
  content = content.replace(
    `import { useMocks } from '../hooks/useMocks';`,
    `import { useMocks } from '../hooks/useMocks';\nimport { useLeaderboardRank } from '../hooks/useLeaderboardRank';`
  );
}

fs.writeFileSync('src/components/Dashboard.tsx', content);
