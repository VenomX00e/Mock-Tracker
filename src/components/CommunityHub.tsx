import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, getDocs, collectionGroup, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, addDoc, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../services/AuthContext';
import { UserProfile, MockScore } from '../types';
import { Trophy, Flame, Target, Users, Calendar, ArrowRight, Trash2, ShieldAlert, ArchiveRestore, Send, MessageSquare, Pencil, X } from 'lucide-react';
import { getHeatmapColor, getPlatformShort, parseLocalDate } from '../lib/utils';
import { CustomDropdown } from './CustomDropdown';

export default function CommunityHub({ 
  onCopyMock,
  onUserClick,
  isAdmin
}: { 
  onCopyMock?: (mock: MockScore) => void;
  onUserClick?: (profile: any) => void;
  isAdmin?: boolean;
}) {
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string | null, direction: 'asc'|'desc'|null }>({ key: 'avgPercentile', direction: 'desc' });
  const [feedSort, setFeedSort] = useState<{ key: string | null, direction: 'asc'|'desc'|null }>({ key: null, direction: null });
  const [feedLogs, setFeedLogs] = useState<any[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [daysVisible, setDaysVisible] = useState(1);
  const [userMap, setUserMap] = useState<Record<string, UserProfile>>({});
  const [reactions, setReactions] = useState<Record<string, { count: number, hasReacted: boolean }>>({});
  const [showTrash, setShowTrash] = useState(false);
  const [deletedMocks, setDeletedMocks] = useState<MockScore[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  
  // Global sort config effect
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const d = await getDoc(doc(db, 'system', 'leaderboardSettings'));
        if (d.exists()) {
           const data = d.data();
           if (data.defaultSortKey) {
             setSortConfig({ key: data.defaultSortKey, direction: data.defaultSortDirection || 'desc' });
           }
        }
      } catch(e) {}
    };
    fetchSettings();
  }, []);

  const handleAdminChangeGlobalSort = async (key: string) => {
     if (!isAdmin) return;
     const direction = 'desc'; // Assuming desc by default for simplicity when changing
     setSortConfig({ key, direction });
     try {
       await setDoc(doc(db, 'system', 'leaderboardSettings'), { defaultSortKey: key, defaultSortDirection: direction }, { merge: true });
     } catch (e) { console.error("Error saving global sort", e); }
  };

  const handleReact = (e: React.MouseEvent, mockId: string) => {
    e.stopPropagation();
    setReactions(prev => {
      const current = prev[mockId] || { count: 0, hasReacted: false };
      
      if (current.hasReacted) {
        return { ...prev, [mockId]: { count: Math.max(0, current.count - 1), hasReacted: false } };
      } else {
        return { ...prev, [mockId]: { count: current.count + 1, hasReacted: true } };
      }
    });
  };

  const handleAdminSoftDelete = async (e: React.MouseEvent, mock: MockScore) => {
     e.stopPropagation();
     if (!isAdmin || !mock.userId) return;
     if (window.confirm('Hide this mock from the community feed?')) {
        try {
           // Optimistic UI updates
           setFeedLogs(logs => {
              return logs.map(day => ({
                 ...day,
                 mocks: day.mocks.filter((m: MockScore) => m.id !== mock.id)
              })).filter(day => day.mocks.length > 0);
           });
           setDeletedMocks(prev => [mock, ...prev]);

            await updateDoc(doc(db, 'users', mock.userId, 'mocks', mock.id), { isDeleted: true, updatedAt: serverTimestamp() });
        } catch (err) {
           console.error("Error soft deleting mock:", err);
           if (err instanceof Error) {
               alert("Failed to delete from database: " + err.message + ". It is hidden for this session.");
           } else {
               alert("Failed to delete from database. It is hidden for this session.");
           }
        }
     }
  };

  const handleAdminRestore = async (mock: MockScore) => {
     if (!isAdmin || !mock.userId) return;
     try {
        setDeletedMocks(prev => prev.filter(m => m.id !== mock.id));
        await updateDoc(doc(db, 'users', mock.userId, 'mocks', mock.id), { isDeleted: false, updatedAt: serverTimestamp() });
        window.location.reload();
     } catch (err) {
        console.error("Error restoring mock", err);
     }
  };

  const handleAdminPermanentDelete = async (mock: MockScore) => {
     if (!isAdmin) return;
     if (window.confirm('Permanently delete this mock from the database? This cannot be undone.')) {
        try {
           await deleteDoc(doc(db, 'users', mock.userId, 'mocks', mock.id));
           setDeletedMocks(prev => prev.filter(m => m.id !== mock.id));
        } catch (err) {
           console.error("Error permanently deleting mock", err);
        }
     }
  };

  useEffect(() => {
    const timeLimit = Date.now() - 48 * 60 * 60 * 1000;
    
    // Cleanup old messages to save storage
    const cleanupOldMessages = async () => {
      if (!user) return;
      try {
        const oldMsgsQ = query(collection(db, 'community_chat'), where('createdAt', '<=', timeLimit));
        const oldSnap = await getDocs(oldMsgsQ);
        oldSnap.docs.forEach(d => {
           if (isAdmin || d.data().userId === user.uid) {
             deleteDoc(d.ref).catch(() => {});
           }
        });
      } catch(e) {}
    };
    cleanupOldMessages();

    const q = query(collection(db, 'community_chat'), where('createdAt', '>', timeLimit), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChatMessages(messages);
      setTimeout(() => {
         const chatDiv = document.getElementById('community-chat-scroll');
         if (chatDiv) {
           chatDiv.scrollTo({ top: chatDiv.scrollHeight, behavior: 'smooth' });
         }
      }, 100);
    }, (error) => {
      console.warn("Chat subscription error:", error);
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending) return;
    
    // Check limit
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const startOfDay = midnight.getTime();
    const userMsgCount = chatMessages.filter(m => m.userId === user.uid && m.createdAt > startOfDay).length;
    
    if (userMsgCount >= 10 && !isAdmin && !editingMessageId) {
      setChatError(`You have reached the limit of 10 messages today. Try again tomorrow!`);
      setTimeout(() => setChatError(''), 4000);
      return;
    }

    setIsSending(true);
    try {
      if (editingMessageId) {
        await updateDoc(doc(db, 'community_chat', editingMessageId), {
          text: newMessage.trim(),
          isEdited: true,
          updatedAt: Date.now()
        });
        setEditingMessageId(null);
        setNewMessage('');
        setIsSending(false);
        return;
      }

      await addDoc(collection(db, 'community_chat'), {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhoto: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'A'}`,
        text: newMessage.trim(),
        createdAt: Date.now()
      });
      setNewMessage('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (msgId: string, authorId: string) => {
     if (user?.uid !== authorId && !isAdmin) return;
     try {
        await deleteDoc(doc(db, 'community_chat', msgId));
     } catch (err: any) { 
        console.error(err);
        setChatError(err.message || 'Failed to delete message');
        setTimeout(() => setChatError(''), 3000);
     }
  };

  // Fetch Leaderboard and Users
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('avgPercentile', 'desc'));
        const snap = await getDocs(q);
        const users = snap.docs.map(d => d.data() as UserProfile);
        
        // Filter out banned/muted users from leaderboard
        const visibleUsers = users.filter((u) => !u.isBanned && !u.isMuted);
        
        const map: Record<string, UserProfile> = {};
        users.forEach(u => map[u.userId] = u);
        setUserMap(map);

        setAllUsers(visibleUsers.filter(u => u.totalTests > 0));
      } catch (e) {
        console.error(e);
      }
      setLoadingTop(false);
    };
    fetchLeaderboard();
  }, []);

  // Fetch Feed
  useEffect(() => {
    const fetchFeed = async () => {
      if (Object.keys(userMap).length === 0) return; // Wait for users to load
      setLoadingFeed(true);
      try {
        const q = query(collectionGroup(db, 'mocks'), orderBy('date', 'desc'), limit(200));
        const snap = await getDocs(q);
        
        let mocks = snap.docs.map(d => {
            const data = d.data() as MockScore;
            if (!data.id) {
                data.id = d.id;
            }
            if (!data.userId) {
                data.userId = d.ref.parent.parent?.id;
            }
            return data;
        });
        
        // Setup deleted mocks separately for admin
        if (isAdmin) {
           setDeletedMocks(mocks.filter(m => (m as any).isDeleted === true));
        }

        // Filter out mocks from banned or muted users, and soft deleted mocks
        mocks = mocks.filter(m => {
           if ((m as any).isDeleted) return false;
           const p = userMap[m.userId!];
           if (!p) return true;
           if (p.isBanned || p.isMuted) return false;
           return true;
        });

        // Group by Date -> ExamName -> Mocks (sorted by percentile)
        const profileToMocksMap: Record<string, MockScore[]> = {};
        mocks.forEach(m => {
          if (!profileToMocksMap[m.userId!]) profileToMocksMap[m.userId!] = [];
          profileToMocksMap[m.userId!].push(m);
        });
        
        // Dynamically calculate user active streak mapping for the feed to fix corrupt DB fields
        const userDateToStreakMap: Record<string, number> = {};
        for (const [userId, userMocks] of Object.entries(profileToMocksMap)) {
           const midnights = [...new Set(userMocks.map(m => {
              const d = parseLocalDate(m.date);
              return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
           }))].sort((a,b) => b - a);
           
           for (let idx = 0; idx < midnights.length; idx++) {
               let streak = 1;
               let currentDt = new Date(midnights[idx]);
               for (let i = idx + 1; i < midnights.length; i++) {
                  let prev = new Date(currentDt);
                  prev.setDate(prev.getDate() - 1);
                  if (midnights[i] === prev.getTime()) {
                      streak++;
                      currentDt = prev;
                  } else {
                      break;
                  }
               }
               // key format: userId_Mon, Apr 20, 2026
               const targetDt = new Date(midnights[idx]);
               const dateStrKey = targetDt.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
               userDateToStreakMap[`${userId}_${dateStrKey}`] = streak;
           }
        }

        const grouped: any = {};
        mocks.forEach(m => {
           
          const mockDate = parseLocalDate(m.date);
          const dateStr = mockDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
          if (!grouped[dateStr]) grouped[dateStr] = {};
          if (!grouped[dateStr][m.mockName]) grouped[dateStr][m.mockName] = [];
          
          const profile = userMap[m.userId!] || {};
          const key = m.userId + '_' + dateStr;
          
          grouped[dateStr][m.mockName].push({
             ...m,
             userName: profile.displayName || (m as any).userName || 'Anonymous',
             userStreak: userDateToStreakMap[key] || 1,
             userStreakActive: true, // Always active in feed since they posted a mock that day
             userPhoto: profile.photoURL || `https://ui-avatars.com/api/?name=${(m as any).userName || 'A'}`,
             userProfileRef: { ...profile, todaysMocks: profileToMocksMap[m.userId!].filter(tm => parseLocalDate(tm.date).toDateString() === new Date().toDateString()) }
          });
        });

        // Convert to array format
        const finalFeed = [];
        for (const date of Object.keys(grouped).sort((a,b) => new Date(b).getTime() - new Date(a).getTime())) {
          const examsObj = grouped[date];
          const examsArray = [];
          for (const examName of Object.keys(examsObj)) {
            // Sort mocks inside exam by percentile desc
            const sortedMocks = examsObj[examName].sort((a: MockScore, b: MockScore) => b.percentile - a.percentile);
            // Calculate earliest time of this exam to sort exams later
            const earliestTime = Math.min(...sortedMocks.map((m: MockScore) => parseLocalDate(m.date).getTime()));
            examsArray.push({ examName, mocks: sortedMocks, earliestTime });
          }
          // Sort exams by earliest time descending (recent first, meaning first exam of the day is last) 
          examsArray.sort((a, b) => b.earliestTime - a.earliestTime);
          
          const universalRows = [];
          for (const eg of examsArray) {
             universalRows.push(...eg.mocks);
          }
          finalFeed.push({ date, mocks: universalRows });
        }
        setFeedLogs(finalFeed);
      } catch (e) {
        console.error(e);
      }
      setLoadingFeed(false);
    };
    fetchFeed();
  }, [daysVisible, userMap]);

  const handleSort = (key: string) => {
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'desc') setSortConfig({ key, direction: 'asc' });
      else if (sortConfig.direction === 'asc') setSortConfig({ key: null, direction: null });
    } else {
      setSortConfig({ key, direction: 'desc' });
    }
  };

  const handleFeedSort = (key: string) => {
    if (feedSort.key === key) {
      if (feedSort.direction === 'desc') setFeedSort({ key, direction: 'asc' });
      else if (feedSort.direction === 'asc') setFeedSort({ key: null, direction: null });
    } else {
      setFeedSort({ key, direction: 'desc' });
    }
  };

  const getFeedSortConfig = (key: string) => {
    if (feedSort.key !== key) return null;
    return feedSort.direction === 'desc' ? '⬇' : '⬆';
  };

  const sortedLeaderboard = [...allUsers].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    let aVal = (a as any)[sortConfig.key] || 0;
    let bVal = (b as any)[sortConfig.key] || 0;
    
    // Fix streak sorting by using 0 if the streak is broken (older than yesterday)
    if (sortConfig.key === 'streak') {
      const todayDt = new Date();
      const today = new Date(todayDt.getFullYear(), todayDt.getMonth(), todayDt.getDate()).getTime();
      
      if (a.lastMockDate) {
         const dA = parseLocalDate(a.lastMockDate);
         const lastDtA = new Date(dA.getFullYear(), dA.getMonth(), dA.getDate()).getTime();
         if (lastDtA < today - 86400000) aVal = 0;
      } else { aVal = 0; }
      
      if (b.lastMockDate) {
         const dB = parseLocalDate(b.lastMockDate);
         const lastDtB = new Date(dB.getFullYear(), dB.getMonth(), dB.getDate()).getTime();
         if (lastDtB < today - 86400000) bVal = 0;
      } else { bVal = 0; }
    }
    
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-8 mt-6 lg:mt-8 mb-4">
      {/* LEADERBOARD */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
               <Trophy className="w-5 h-5 text-amber-500" /> Leaderboard
             </h3>
             {isAdmin && (
                <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-3">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400">Admin Default</span>
                  <div className="w-[180px]">
                    <CustomDropdown 
                       value={sortConfig.key || ''}
                       onChange={handleAdminChangeGlobalSort}
                       options={['avgPercentile', 'avgAccuracy', 'totalTests', 'streak']}
                       placeholder="Select default"
                    />
                  </div>
                </div>
             )}
          </div>
        </div>
        <div className="overflow-x-auto">
          {loadingTop ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">Loading Leaderboard...</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="p-4 font-semibold text-center hidden sm:table-cell">Rank</th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('displayName')}>Aspirant {sortConfig.key === 'displayName' && sortConfig.direction && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('avgPercentile')}>Avg %ile {sortConfig.key === 'avgPercentile' && sortConfig.direction && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('avgQuantPercentile')}>Quant {sortConfig.key === 'avgQuantPercentile' && sortConfig.direction && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('avgReasoningPercentile')}>Reasoning {sortConfig.key === 'avgReasoningPercentile' && sortConfig.direction && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('avgEnglishPercentile')}>English {sortConfig.key === 'avgEnglishPercentile' && sortConfig.direction && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('totalTests')}>Tests {sortConfig.key === 'totalTests' && sortConfig.direction && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSort('streak')}>Streak {sortConfig.key === 'streak' && sortConfig.direction && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {sortedLeaderboard.map((user, idx) => {
                  const now = new Date();
                  let displayStreak = 0;
                  let isToday = false;
                  
                  if (user.lastMockDate) {
                     const todayDt = new Date();
                     const today = new Date(todayDt.getFullYear(), todayDt.getMonth(), todayDt.getDate()).getTime();
                     const d = parseLocalDate(user.lastMockDate);
                     const lastMockDt = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                     
                     // 86400000 ms is one day
                     const isYesterday = lastMockDt === today - 86400000;
                     isToday = lastMockDt === today;
                     
                     const isZeroStreak = lastMockDt < today - 86400000;
                     displayStreak = isZeroStreak ? 0 : (user.streak || 0);
                  }
                  
                  return (
                  <tr key={user.userId} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-bold text-slate-400 dark:text-slate-500 text-center hidden sm:table-cell">#{idx + 1}</td>
                    <td className="p-4">
                      <div 
                         className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors inline-flex"
                         onClick={() => {
                            if (onUserClick) {
                               onUserClick({ ...user, leaderboardRank: idx + 1 });
                            }
                         }}
                      >
                        <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{user.displayName}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{user.targetedExam}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center font-mono font-medium"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${getHeatmapColor(user.avgPercentile)}`}>{user.avgPercentile}%</span></td>
                    <td className="p-4 text-center font-mono text-slate-600 dark:text-slate-400"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${getHeatmapColor(user.avgQuantPercentile)}`}>{user.avgQuantPercentile}%</span></td>
                    <td className="p-4 text-center font-mono text-slate-600 dark:text-slate-400"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${getHeatmapColor(user.avgReasoningPercentile)}`}>{user.avgReasoningPercentile}%</span></td>
                    <td className="p-4 text-center font-mono text-slate-600 dark:text-slate-400"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${getHeatmapColor(user.avgEnglishPercentile)}`}>{user.avgEnglishPercentile}%</span></td>
                    <td className="p-4 text-center font-mono text-slate-600 dark:text-slate-300">{user.totalTests}</td>
                    <td className={`p-4 text-center font-medium flex items-center justify-center gap-1 ${isToday ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}>
                      <Flame className={`w-4 h-4 ${isToday ? '' : 'text-slate-300 dark:text-slate-600'}`} /> {displayStreak}
                    </td>
                  </tr>
                )})}
                {sortedLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 dark:text-slate-500">No data available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* FEED */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" /> Community Log
          </h3>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-900">
          {loadingFeed ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">Loading community logs...</div>
          ) : (
            <div className="space-y-8">
              {(() => {
                const flattenFeed = () => {
                  const flat: any[] = [];
                  feedLogs.slice(0, daysVisible).forEach(dg => {
                    flat.push(...dg.mocks);
                  });
                  return flat;
                };

                const flatFeed = flattenFeed();
                let feedToDisplay = null;
                
                if (feedSort.key && feedSort.direction) {
                  feedToDisplay = [...flatFeed].sort((a, b) => {
                    let aVal = a[feedSort.key];
                    let bVal = b[feedSort.key];
                    if (feedSort.key.includes('.')) {
                      const parts = feedSort.key.split('.');
                      aVal = a[parts[0]]?.[parts[1]];
                      bVal = b[parts[0]]?.[parts[1]];
                    }
                    if (aVal == null) aVal = '';
                    if (bVal == null) bVal = '';
                    const numA = Number(aVal);
                    const numB = Number(bVal);
                    if (!isNaN(numA) && !isNaN(numB) && aVal !== '' && bVal !== '') {
                      return feedSort.direction === 'desc' ? numB - numA : numA - numB;
                    }
                    if (String(aVal).toLowerCase() < String(bVal).toLowerCase()) return feedSort.direction === 'asc' ? -1 : 1;
                    if (String(aVal).toLowerCase() > String(bVal).toLowerCase()) return feedSort.direction === 'asc' ? 1 : -1;
                    return 0;
                  });
                }
                
                const tableHeader = (
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('userName')}>Aspirant {getFeedSortConfig('userName')}</th>
                              <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('mockName')}>Mock Name {getFeedSortConfig('mockName')}</th>
                              <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('examType')}>Exam {getFeedSortConfig('examType')}</th>
                              <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('score')}>Score {getFeedSortConfig('score')}</th>
                              <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('percentile')}>Percentile {getFeedSortConfig('percentile')}</th>
                              <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('quant.score')}>Quant {getFeedSortConfig('quant.score')}</th>
                              <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('reasoning.score')}>Reasoning {getFeedSortConfig('reasoning.score')}</th>
                              <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('english.score')}>English {getFeedSortConfig('english.score')}</th>
                              <th className="px-4 py-3 font-semibold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleFeedSort('ga.score')}>GA {getFeedSortConfig('ga.score')}</th>
                              <th className="px-4 py-3 w-10"></th>
                            </tr>
                          </thead>
                );

                const renderFeedRow = (m: any) => (
                              <tr 
                                key={m.id} 
                                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                onClick={() => onCopyMock && onCopyMock(m)}
                                title="Add this mock score to your dashboard"
                              >
                                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                                  <div 
                                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors inline-flex"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const rank = sortedLeaderboard.findIndex(u => u.userId === m.userId) + 1;
                                        if (onUserClick && (m as any).userProfileRef) {
                                            onUserClick({ ...(m as any).userProfileRef, leaderboardRank: rank > 0 ? rank : undefined });
                                        }
                                    }}
                                  >
                                    <img src={(m as any).userPhoto} alt="" className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700" />
                                    <span className="text-slate-800 dark:text-slate-200">{(m as any).userName}</span>
                                    {(m as any).userStreak > 0 && (
                                       <span className={`flex items-center ml-1 ${(m as any).userStreakActive ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}`}>
                                         <Flame className={`w-3 h-3 ${(m as any).userStreakActive ? 'animate-pulse' : ''}`} /> {(m as any).userStreak}
                                       </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{m.mockName}</span>
                                    <div className="flex gap-1.5 mt-1">
                                      {m.platform && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-medium">{getPlatformShort(m.platform)}</span>}
                                      {m.examPhase && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-medium">{m.examPhase}</span>}
                                      {m.examScope && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-medium">{m.examScope}</span>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md text-xs font-semibold">
                                     {m.examType}
                                    </span>
                                    {m.examRole && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium">{m.examRole}</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono font-medium text-blue-600 dark:text-blue-400 text-center align-middle">
                                  {m.score != null && m.score !== 0 ? m.score : '-'}
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                  <div className="flex flex-col items-center gap-1">
                                    {m.percentile != null && m.percentile !== 0 ? (
                                      <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-mono font-medium rounded ${getHeatmapColor(m.percentile)}`}>
                                        {m.percentile}%P
                                      </span>
                                    ) : <span className="text-slate-300">-</span>}
                                    {m.accuracy != null && m.accuracy !== 0 && (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-medium ${getHeatmapColor(m.accuracy)}`}>
                                        {m.accuracy}%A
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                   <div className="flex flex-col items-center">
                                      <span className="font-mono text-slate-600 dark:text-slate-300">{m.quant?.score != null && m.quant.score !== 0 ? m.quant.score : '-'}</span>
                                      <div className="flex flex-col gap-0.5 mt-1 items-center">
                                        {m.quant?.percentile != null && m.quant.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(m.quant.percentile)}`}>{m.quant.percentile}%P</span>}
                                        {m.quant?.accuracy != null && m.quant.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(m.quant.accuracy)}`}>{m.quant.accuracy}%A</span>}
                                      </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                    <div className="flex flex-col items-center">
                                      <span className="font-mono text-slate-600 dark:text-slate-300">{m.reasoning?.score != null && m.reasoning.score !== 0 ? m.reasoning.score : '-'}</span>
                                      <div className="flex flex-col gap-0.5 mt-1 items-center">
                                        {m.reasoning?.percentile != null && m.reasoning.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(m.reasoning.percentile)}`}>{m.reasoning.percentile}%P</span>}
                                        {m.reasoning?.accuracy != null && m.reasoning.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(m.reasoning.accuracy)}`}>{m.reasoning.accuracy}%A</span>}
                                      </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                    <div className="flex flex-col items-center">
                                      <span className="font-mono text-slate-600 dark:text-slate-300">{m.english?.score != null && m.english.score !== 0 ? m.english.score : '-'}</span>
                                      <div className="flex flex-col gap-0.5 mt-1 items-center">
                                        {m.english?.percentile != null && m.english.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(m.english.percentile)}`}>{m.english.percentile}%P</span>}
                                        {m.english?.accuracy != null && m.english.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(m.english.accuracy)}`}>{m.english.accuracy}%A</span>}
                                      </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                    <div className="flex flex-col items-center">
                                      <span className="font-mono text-slate-600 dark:text-slate-300">{m.ga?.score != null && m.ga.score !== 0 ? m.ga.score : '-'}</span>
                                      <div className="flex flex-col gap-0.5 mt-1 items-center">
                                        {m.ga?.percentile != null && m.ga.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(m.ga.percentile)}`}>{m.ga.percentile}%P</span>}
                                        {m.ga?.accuracy != null && m.ga.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(m.ga.accuracy)}`}>{m.ga.accuracy}%A</span>}
                                      </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                    <div className="flex justify-end items-center gap-2 pr-2">
                                      <button 
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full transition-colors text-xs font-medium text-slate-700 dark:text-slate-300"
                                        onClick={(e) => handleReact(e, m.id)}
                                      >
                                        <span className="text-sm">🔥</span> 
                                        <span>{reactions[m.id]?.count ?? 0}</span>
                                      </button>
                                    </div>
                                </td>
                              </tr>
                );

                if (feedToDisplay) {
                  return (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm mt-4">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          {tableHeader}
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                            {feedToDisplay.map((m: any) => renderFeedRow(m))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }

                return feedLogs.slice(0, daysVisible).map((dayGroup, idx) => (
                  <div key={dayGroup.date} className="animate-in fade-in slide-in-from-bottom-2">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" /> {dayGroup.date}
                    </h4>
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                            {tableHeader}
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                              {dayGroup.mocks.map((m: MockScore) => renderFeedRow(m))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}

              {daysVisible < feedLogs.length && (
                <div className="text-center pt-0 pb-1 -mt-2 -mb-1">
                  <button 
                    onClick={() => setDaysVisible(prev => prev + 3)}
                    className="inline-flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-sm font-medium text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    View Next {Math.min(3, feedLogs.length - daysVisible)} Days <ArrowRight className="w-4 h-4 ml-1.5" />
                  </button>
                </div>
              )}
              {feedLogs.length === 0 && (
                 <div className="text-center text-slate-400 py-4">No community data yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* CHAT SECTION */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-[450px]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" /> Community Chat
          </h3>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded">Messages vanish after 48h</span>
        </div>
        <div id="community-chat-scroll" className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/30">
          {chatMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">Say hi to everyone!</div>
          ) : (
            chatMessages.map(msg => {
              const uProfile = userMap[msg.userId] || {};
              const displayName = msg.userId === user?.uid ? 'You' : (uProfile.displayName || msg.userName);
              const photoURL = uProfile.photoURL || msg.userPhoto;
              return (
                <div 
                  key={msg.id} 
                  className={`flex gap-3 max-w-[85%] ${msg.userId === user?.uid ? 'ml-auto flex-row-reverse' : ''}`}
                  onClick={() => setActiveMsgId(activeMsgId === msg.id ? null : msg.id)}
                >
                  <img src={photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-200 object-cover" />
                  <div className={`flex flex-col gap-1 ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{displayName}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`relative px-4 py-2 text-sm rounded-2xl group ${msg.userId === user?.uid ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-600 shadow-sm rounded-tl-sm'}`}>
                      {msg.text}
                      {msg.isEdited && <span className="text-[10px] opacity-70 ml-2">(edited)</span>}
                      {(msg.userId === user?.uid || isAdmin) && (
                        <div className={`absolute top-1/2 -translate-y-1/2 transition-opacity flex items-center gap-1.5 z-10 ${activeMsgId === msg.id ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'} ${msg.userId === user?.uid ? '-left-[4.5rem]' : '-right-[4.5rem]'}`}>
                         {msg.userId === user?.uid && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setEditingMessageId(msg.id); 
                                setNewMessage(msg.text); 
                                setActiveMsgId(null);
                              }} 
                              className={`p-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full shadow-sm hover:scale-110`} 
                              title="Edit message"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                         )}
                         <button 
                           onClick={(e) => { 
                              e.stopPropagation(); 
                              handleDeleteMessage(msg.id, msg.userId); 
                              setActiveMsgId(null);
                           }} 
                           className={`p-1.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full shadow-sm hover:scale-110`} 
                           title="Delete message"
                         >
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
          )}
          <div ref={chatBottomRef} />
        </div>
        <div className="relative">
          {chatError && (
             <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-red-100 dark:bg-red-900/90 text-red-600 dark:text-red-200 px-4 py-2 rounded-lg text-sm font-medium z-10 whitespace-nowrap shadow-md">
               {chatError}
             </div>
          )}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-2">
            {editingMessageId && (
               <button type="button" onClick={() => { setEditingMessageId(null); setNewMessage(''); }} className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                 <X className="w-5 h-5" />
               </button>
            )}
            <input 
              type="text" 
              autoComplete="off"
              spellCheck="false"
              name="chatMsg"
              id="chatMsg"
              maxLength={2000}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder={editingMessageId ? "Edit message..." : (user ? "Type a message..." : "Sign in to chat")}
              disabled={!user || isSending}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-slate-800 dark:text-slate-200"
            />
            <button 
              type="submit" 
              disabled={!user || !newMessage.trim() || isSending}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
      
      {showTrash && isAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Moderation Trash</h3>
              </div>
              <button 
                onClick={() => setShowTrash(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
               {deletedMocks.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No deleted mocks.</p>
               ) : (
                  <div className="space-y-3">
                     {deletedMocks.map(m => {
                        const user = userMap[m.userId!] || {};
                        return (
                          <div key={m.id} className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4 border border-red-100 dark:border-red-900/30 rounded-xl bg-red-50/50 dark:bg-red-900/10">
                            <div>
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-slate-800 dark:text-slate-200">{user.displayName || 'Unknown'}</span>
                                  <span className="text-xs text-slate-500">{new Date(m.date).toLocaleDateString()}</span>
                               </div>
                               <div className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                                  {m.examType} - {m.mockName} 
                                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded shadow-sm flex gap-2">
                                      <span>Score: {m.score}</span>
                                      <span>{m.percentile}%ile</span>
                                  </span>
                               </div>
                            </div>
                            <div className="flex items-center gap-2">
                               <button 
                                 onClick={() => handleAdminRestore(m)}
                                 className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 rounded-lg transition-colors"
                               >
                                 Restore
                               </button>
                               <button 
                                 onClick={() => handleAdminPermanentDelete(m)}
                                 className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-lg transition-colors flex items-center gap-1.5"
                               >
                                 <Trash2 className="w-4 h-4" /> Purge
                               </button>
                            </div>
                          </div>
                        )
                     })}
                  </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
