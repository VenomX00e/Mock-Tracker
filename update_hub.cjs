const fs = require('fs');

let content = fs.readFileSync('src/components/CommunityHub.tsx', 'utf-8');

// Replace imports if needed
if (!content.includes('useCommunityPosts')) {
  content = content.replace(
    `import { CommunityHubTrashModal } from './community/CommunityHubTrashModal';`,
    `import { CommunityHubTrashModal } from './community/CommunityHubTrashModal';\nimport { useCommunityPosts } from './community/useCommunityPosts';`
  );
}

const lines = content.split('\n');

const newLines = [];
let skipStart = false;

for (let i = 0; i < lines.length; i++) {
   const line = lines[i];

   if (line.includes('const [allUsers, setAllUsers] = useState<UserProfile[]>([])')) {
     skipStart = true;
     // insert the hook usage
     newLines.push(`  const {
    allUsers, 
    feedLogs, 
    allFeedMocks, 
    loadingTop, 
    loadingFeed,
    userMap,
    deletedMocks, setDeletedMocks,
    chatMessages,
    sortConfig, setSortConfig,
    daysVisible, setDaysVisible
  } = useCommunityPosts(user, isAdmin, categoryId);`);
     newLines.push(`  const [feedSort, setFeedSort] = useState<{ key: string | null, direction: 'asc'|'desc'|null }>({ key: null, direction: null });`);
     newLines.push(`  const [selectedPhase, setSelectedPhase] = useState<string>('All');`);
     newLines.push(`  const [selectedPeriod, setSelectedPeriod] = useState<string>('7 Days');`);
     newLines.push(`  const [reactions, setReactions] = useState<Record<string, { count: number, hasReacted: boolean }>>({});`);
     newLines.push(`  const [showTrash, setShowTrash] = useState(false);`);
     newLines.push(`  const [newMessage, setNewMessage] = useState('');`);
     continue;
   }

   if (skipStart && line.includes('const [newMessage, setNewMessage]')) {
      skipStart = false;
      continue;
   }
   
   if (skipStart) continue;

   if (line.includes('const isFirstLoad = useRef(true);')) {
      // skip this line
      continue;
   }
   
   // Skip the use effects: Global sort config effect
   if (line.includes('// Global sort config effect')) {
      let isEffect = true;
      while (isEffect && i < lines.length) {
         if (lines[i+1].includes('const handleSendMessage')) {
             isEffect = false;
         } else {
             i++;
         }
      }
      continue;
   }

   // Skip Fetch Leaderboard and Users
   if (line.includes('// Fetch Leaderboard and Users')) {
      let isEffect = true;
      while (isEffect && i < lines.length) {
         if (lines[i+1].includes('const grouped: any = {};') || lines[i+1].includes('const handleSort = (key: string) => {')) {
             isEffect = false;
             // Oh wait fetchFeed is right after fetchLeaderboard
         } else {
             i++;
         }
      }
      continue;
   }
   
   // Actually fetchLeaderboard goes until handleSort, wait let's be careful. Let's just find the exact block

   newLines.push(line);
}

fs.writeFileSync('temp.ts', newLines.join('\n'));
