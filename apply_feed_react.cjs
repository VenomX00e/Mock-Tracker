const fs = require('fs');

let text = fs.readFileSync('src/components/CommunityHub.tsx', 'utf-8');

text = text.replace(
`  const handleReact = async (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
       await setDoc(doc(db, 'community_chat', msgId, 'reactions', user.uid), {
          uid: user.uid,
          timestamp: serverTimestamp()
       });
    } catch(error) {}
  };`,
`  const handleReact = async (e: React.MouseEvent, mockId: string, mockUserId: string) => {
    e.stopPropagation();
    if (!user) return;
    
    // Optimistic UI update
    const prevFeedLogs = [...feedLogs];
    let isLiking = true;

    setFeedLogs(prevFeedLogs.map((group: any) => ({
       ...group,
       mocks: group.mocks.map((m: any) => {
          if (m.id === mockId) {
             const likes = m.likes || [];
             if (likes.includes(user.uid)) {
                 isLiking = false;
                 return { ...m, likes: likes.filter((uid: string) => uid !== user.uid) };
             } else {
                 return { ...m, likes: [...likes, user.uid] };
             }
          }
          return m;
       })
    })));

    setAllFeedMocks(allFeedMocks.map((m: any) => {
          if (m.id === mockId) {
             const likes = m.likes || [];
             if (likes.includes(user.uid)) {
                 return { ...m, likes: likes.filter((uid: string) => uid !== user.uid) };
             } else {
                 return { ...m, likes: [...likes, user.uid] };
             }
          }
          return m;
    }));

    try {
       const mockRef = doc(db, 'users', mockUserId, 'mocks', mockId);
       const docSnap = await getDoc(mockRef);
       if (docSnap.exists()) {
           const data = docSnap.data();
           let likes = data.likes || [];
           if (isLiking) {
               if (!likes.includes(user.uid)) likes.push(user.uid);
           } else {
               likes = likes.filter((uid: string) => uid !== user.uid);
           }
           await updateDoc(mockRef, { likes });
       }
    } catch(error) {
       // rollback on error
       setFeedLogs(prevFeedLogs);
    }
  };`
);

text = text.replace(
  '<CommunityFeed Users={Users}',
  '<CommunityFeed user={user} Users={Users}'
);

text = text.replace(
  'const { Users, loadingFeed,',
  'const { user, Users, loadingFeed,'
);

text = text.replace(
`                                        onClick={(e) => handleReact(e, m.id)}
                                      >
                                        <span className="text-sm">🔥</span> 
                                        <span>{reactions[m.id]?.count ?? 0}</span>`,
`                                        onClick={(e) => handleReact(e, m.id, m.userId)}
                                        className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors text-xs font-medium " + (user && m.likes?.includes(user.uid) ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300")}
                                      >
                                        <span className="text-sm">🔥</span> 
                                        <span>{m.likes?.length || 0}</span>`
);

text = text.replace(
`                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full transition-colors text-xs font-medium text-slate-700 dark:text-slate-300"
`,
``
);

fs.writeFileSync('src/components/CommunityHub.tsx', text);
