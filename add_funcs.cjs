const fs = require('fs');

let content = fs.readFileSync('src/components/CommunityHub.tsx', 'utf-8');

const missingFuncs = `
  const handleAdminRestore = async (mock: any) => {
    try {
      await updateDoc(doc(db, 'mocks', mock.id), { isDeleted: false }, { merge: true });
    } catch(e) {}
  };

  const handleAdminPermanentDelete = async (mock: any) => {
    try {
      await deleteDoc(doc(db, 'mocks', mock.id));
    } catch(e) {}
  };

  const handleAdminChangeGlobalSort = async (key: string, direction: string = 'desc') => {
    try {
      if (isAdmin) {
         await setDoc(doc(db, 'system', 'leaderboardSettings'), { defaultSortKey: key, defaultSortDirection: direction }, { merge: true });
      }
    } catch(e) {}
  };

  const handleReact = async (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
       await setDoc(doc(db, 'community_chat', msgId, 'reactions', user.uid), {
          uid: user.uid,
          timestamp: serverTimestamp()
       });
    } catch(error) {}
  };

`;

const lines = content.split('\n');
lines.splice(499, 0, missingFuncs);
fs.writeFileSync('src/components/CommunityHub.tsx', lines.join('\n'));
