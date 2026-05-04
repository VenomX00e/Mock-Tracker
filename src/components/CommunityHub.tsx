import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, getDocs, collectionGroup, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, addDoc, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../services/AuthContext';
import { UserProfile, MockScore } from '../types';
import { Trophy, Flame, Target, Users, Calendar, ArrowRight, Trash2, ShieldAlert, ArchiveRestore, Send, MessageSquare, Pencil, X, Reply, BarChart2, CheckCircle2, CheckSquare, Pin, PinOff } from 'lucide-react';
import { motion } from 'motion/react';
import { getHeatmapColor, getPlatformShort, parseLocalDate } from '../lib/utils';
import { CustomDropdown } from './CustomDropdown';
import { ChallengeCard } from './ChallengeCard';

export default function CommunityHub({ 
  onCopyMock,
  onUserClick,
  isAdmin,
  pinnedChallenges = [],
  challenges = [],
  onPinChallenge,
  onEditChallenge,
  onDeleteChallenge,
  onDismissChallenge
}: { 
  onCopyMock?: (mock: MockScore) => void;
  onUserClick?: (profile: any) => void;
  isAdmin?: boolean;
  pinnedChallenges?: string[];
  challenges?: any[];
  onPinChallenge?: (challenge: any) => void;
  onEditChallenge?: (challenge: any) => void;
  onDeleteChallenge?: (challenge: any) => void;
  onDismissChallenge?: (id: string) => void;
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
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);
  const [activeActionsMsgId, setActiveActionsMsgId] = useState<string | null>(null);
  const [showPollVotersForId, setShowPollVotersForId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [showPollMaker, setShowPollMaker] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<{id: string, text: string, isCorrect: boolean}[]>([{id: '1', text: '', isCorrect: false}, {id: '2', text: '', isCorrect: false}]);
  const [pollIsMulti, setPollIsMulti] = useState(false);
  const [activeReactionView, setActiveReactionView] = useState<string | null>(null);
  const [customEmojiOpenForId, setCustomEmojiOpenForId] = useState<string | null>(null);
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);
  
  const isFirstLoad = useRef(true);

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
      
      const hasNewMessages = snap.docChanges().some(change => change.type === 'added');
      if (hasNewMessages || isFirstLoad.current) {
        setTimeout(() => {
           const chatDiv = document.getElementById('community-chat-scroll');
           if (chatDiv) {
             const isNearBottom = chatDiv.scrollHeight - chatDiv.scrollTop <= chatDiv.clientHeight + 150;
             // Scroll to bottom if near bottom, or if it's initial load
             if (isNearBottom || isFirstLoad.current) {
               chatDiv.scrollTo({ top: chatDiv.scrollHeight, behavior: 'smooth' });
             }
           }
           isFirstLoad.current = false;
        }, 100);
      }
    }, (error) => {
      console.warn("Chat subscription error:", error);
    });
    return () => unsubscribe();
  }, [user, isAdmin]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasText = newMessage.trim().length > 0;
    const hasPoll = showPollMaker && pollQuestion.trim().length > 0 && pollOptions.filter(o => o.text.trim().length > 0).length >= 2;
    if (!user || isSending || (!hasText && !hasPoll)) return;
    
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
        const updatePayload: any = {
          text: newMessage.trim(),
          isEdited: true,
          updatedAt: Date.now()
        };
        if (hasPoll) {
          const existingMsg = chatMessages.find(m => m.id === editingMessageId);
          const existingPoll = existingMsg?.poll;
          
          updatePayload.poll = {
            question: pollQuestion.trim(),
            isMulti: pollIsMulti,
            options: pollOptions.filter(o => o.text.trim().length > 0).map(o => {
               const existingOpt = existingPoll?.options?.find((eo: any) => eo.id === o.id);
               return {
                 id: o.id,
                 text: o.text.trim(),
                 isCorrect: o.isCorrect,
                 votes: existingOpt ? existingOpt.votes : {}
               };
            })
          };
        }
        await updateDoc(doc(db, 'community_chat', editingMessageId), updatePayload);
        setEditingMessageId(null);
        setNewMessage('');
        setShowPollMaker(false);
        setPollQuestion('');
        setPollOptions([{id: '1', text: '', isCorrect: false}, {id: '2', text: '', isCorrect: false}]);
        setPollIsMulti(false);
        setIsSending(false);
        return;
      }

      const payload: any = {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhoto: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'A'}`,
        text: newMessage.trim(),
        createdAt: Date.now()
      };

      if (hasPoll) {
        payload.poll = {
          question: pollQuestion.trim(),
          isMulti: pollIsMulti,
          options: pollOptions.filter(o => o.text.trim().length > 0).map(o => ({
            id: o.id,
            text: o.text.trim(),
            isCorrect: o.isCorrect,
            votes: {}
          }))
        };
      }

      if (replyingTo) {
        payload.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text,
          userName: replyingTo.userId === user.uid ? 'You' : (userMap[replyingTo.userId]?.displayName || replyingTo.userName)
        };
      }

      await addDoc(collection(db, 'community_chat'), payload);
      setNewMessage('');
      setReplyingTo(null);
      setShowPollMaker(false);
      setPollQuestion('');
      setPollOptions([{id: '1', text: '', isCorrect: false}, {id: '2', text: '', isCorrect: false}]);
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

  const handlePinMessage = async (msgId: string, currentPinStatus: boolean) => {
     try {
        await updateDoc(doc(db, 'community_chat', msgId), {
           isPinned: !currentPinStatus
        });
     } catch (err: any) {
        console.error(err);
     }
  };

  const handleChatReact = async (msgId: string, emoji: string) => {
    if (!user) return;
    try {
      const msg = chatMessages.find(m => m.id === msgId);
      if (!msg) return;
      
      const reactions = { ...(msg.reactions || {}) };
      
      // Remove this user's reaction from any other emoji for this message
      Object.keys(reactions).forEach(k => {
        if (k !== emoji && reactions[k] && reactions[k][user.uid]) {
          reactions[k] = { ...reactions[k] };
          delete reactions[k][user.uid];
        }
      });
      
      const emojiReacts = reactions[emoji] || {};
      const newEmojiReacts = { ...emojiReacts };
      if (newEmojiReacts[user.uid]) {
        delete newEmojiReacts[user.uid];
      } else {
        newEmojiReacts[user.uid] = true;
      }
      reactions[emoji] = newEmojiReacts;

      setActiveMsgId(null);
      await updateDoc(doc(db, 'community_chat', msgId), {
        reactions
      });
    } catch (e) { console.error(e); }
  };

  const handlePollVote = async (msgId: string, optionId: string) => {
    if (!user) return;
    try {
      const msg = chatMessages.find(m => m.id === msgId);
      if (!msg || !msg.poll) return;

      const newOptions = msg.poll.options.map((opt: any) => {
        const votes = opt.votes || {};
        const newVotes = { ...votes };
        if (opt.id === optionId) {
           if (newVotes[user.uid]) {
             delete newVotes[user.uid];
           } else {
             newVotes[user.uid] = { timestamp: Date.now() };
           }
        } else if (!msg.poll.isMulti) {
           delete newVotes[user.uid];
        }
        return { ...opt, votes: newVotes };
      });

      await updateDoc(doc(db, 'community_chat', msgId), {
        'poll.options': newOptions
      });
    } catch (e) { console.error(e); }
  };

  // Global click listener for chat popups
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveReactionView(null);
      setActiveMsgId(null);
      setCustomEmojiOpenForId(null);
      setActiveActionsMsgId(null);
      setShowPollVotersForId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

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
          
          const profile = userMap[m.userId!] || {} as Partial<UserProfile>;
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
                    <td className="p-4 text-center">
                      <div className={`flex items-center justify-center gap-1 font-medium ${isToday ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        <Flame className={`w-4 h-4 ${isToday ? '' : 'text-slate-300 dark:text-slate-600'}`} /> {displayStreak}
                      </div>
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-[550px]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 shrink-0">
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" /> Community Chat
          </h3>
          <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded w-fit shrink-0 whitespace-nowrap">Auto deletes after 48h</span>
        </div>
        
        {chatMessages.filter(m => m.isPinned).length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-100 dark:border-amber-900 px-4 py-2 flex flex-col gap-1 max-h-24 overflow-y-auto custom-scrollbar">
            {chatMessages.filter(m => m.isPinned).map(msg => (
               <div key={`pin-${msg.id}`} className="flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
                  <div className="flex items-center gap-2 overflow-hidden cursor-pointer" onClick={() => {
                     const el = document.getElementById(`msg-${msg.id}`);
                     if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}>
                     <Pin className="w-3.5 h-3.5 shrink-0" />
                     <span className="truncate opacity-90">{msg.text || (msg.poll ? `📊 ${msg.poll.question}` : '')}</span>
                  </div>
                  <button onClick={() => handlePinMessage(msg.id, true)} className="p-1 hover:bg-amber-200 dark:hover:bg-amber-800 rounded text-amber-700 dark:text-amber-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
               </div>
            ))}
          </div>
        )}

        <div 
          id="community-chat-scroll" 
          className="flex-1 p-4 overflow-y-auto overflow-x-hidden space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/30"
          onClick={() => {
            setActiveMsgId(null);
            setCustomEmojiOpenForId(null);
            setActiveReactionView(null);
            setActiveActionsMsgId(null);
            setShowPollVotersForId(null);
          }}
        >
          {chatMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">Say hi to everyone!</div>
          ) : (
            chatMessages.map(msg => {
              const uProfile = userMap[msg.userId] || {} as Partial<UserProfile>;
              const displayName = msg.userId === user?.uid ? 'You' : (uProfile.displayName || msg.userName);
              const photoURL = uProfile.photoURL || msg.userPhoto;
              const isOnlyPoll = msg.poll && (!msg.text || msg.text === '📊 Poll');
              return (
                <div 
                  key={msg.id}
                  className={`w-full flex ${msg.userId === user?.uid ? 'justify-end' : 'justify-start'}`}
                  onClick={(e) => { e.stopPropagation(); setActiveActionsMsgId(activeActionsMsgId === msg.id ? null : msg.id); setActiveMsgId(null); setActiveReactionView(null); setCustomEmojiOpenForId(null); setShowPollVotersForId(null); }}
                >
                  <motion.div 
                    id={`msg-${msg.id}`}
                    className={`flex sm:gap-3 max-w-[95%] sm:max-w-[85%] ${msg.userId === user?.uid ? 'sm:flex-row-reverse' : ''}`}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.1}
                    onDragEnd={(e, info) => {
                       if (Math.abs(info.offset.x) > 40) {
                           setReplyingTo(msg); 
                           setActiveMsgId(null);
                           document.getElementById('chatMsg')?.focus();
                       }
                    }}
                  >
                  <img src={photoURL} alt="" className="hidden sm:block w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-200 object-cover pointer-events-none mt-1 sm:mt-0" />
                  <div className={`flex flex-col gap-1 w-full max-w-full ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-1.5 ${msg.userId === user?.uid ? 'flex-row-reverse sm:flex-row' : ''}`}>
                      <img src={photoURL} alt="" className="sm:hidden w-5 h-5 rounded-full border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-200 object-cover pointer-events-none" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{displayName}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(msg.createdAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div 
                      className={`relative px-4 py-2 text-sm rounded-2xl ${msg.userId === user?.uid ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-600 shadow-sm rounded-tl-sm'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMsgId(activeMsgId === msg.id ? null : msg.id);
                        setActiveActionsMsgId(null);
                        setActiveReactionView(null);
                        setCustomEmojiOpenForId(null);
                        setShowPollVotersForId(null);
                      }}
                    >
                      {msg.replyTo && (
                        <div 
                          className={`mb-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer relative overflow-hidden ${msg.userId === user?.uid ? 'bg-indigo-700/40 text-indigo-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                          onClick={(e) => {
                             e.stopPropagation();
                             const el = document.getElementById(`msg-${msg.replyTo.id}`);
                             if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                             setShowPollVotersForId(null);
                          }}
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${msg.userId === user?.uid ? 'bg-indigo-400' : 'bg-slate-300 dark:bg-slate-500'}`}></div>
                          <div className="font-semibold">{msg.replyTo.userName}</div>
                          <div className="truncate opacity-90">{msg.replyTo.text}</div>
                        </div>
                      )}
                      {msg.text !== '📊 Poll' && <span className="whitespace-pre-wrap break-words">{msg.text}</span>}
                      {msg.isEdited && <span className="text-[10px] opacity-70 ml-2">(edited)</span>}
                      
                      {msg.poll && (
                        <div className={`${isOnlyPoll ? '' : 'mt-2'}`}>
                          <div className={`font-bold flex items-center gap-1.5 mb-2 leading-tight text-base ${msg.userId === user?.uid ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                            <span>{msg.poll.question}</span> 
                          </div>
                          <div className="space-y-1.5">
                            {msg.poll.options.map((opt: any) => {
                               const voteCount = Object.keys(opt.votes || {}).length;
                               const hasVoted = user && opt.votes && opt.votes[user.uid];
                               const totalVotes = msg.poll.options.reduce((acc: number, o: any) => acc + Object.keys(o.votes || {}).length, 0);
                               const percent = totalVotes === 0 ? 0 : Math.round((voteCount / totalVotes) * 100);
                               const hasCorrectOption = msg.poll.options.some((o:any) => o.isCorrect);
                               const userHasVotedAny = msg.poll.options.some((o:any) => o.votes && o.votes[user?.uid!]);
                               
                               let optionBg = msg.userId === user?.uid ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600';
                               if (hasVoted) optionBg = 'bg-blue-500 dark:bg-blue-600';
                               if (hasCorrectOption && userHasVotedAny) {
                                 if (opt.isCorrect) optionBg = 'bg-emerald-500 dark:bg-emerald-600';
                                 else if (hasVoted) optionBg = 'bg-red-500 dark:bg-red-600';
                               }

                               const showCorrect = hasCorrectOption && userHasVotedAny && opt.isCorrect;
                               const showIncorrect = hasCorrectOption && userHasVotedAny && hasVoted && !opt.isCorrect;

                               return (
                                <button
                                  key={opt.id}
                                  disabled={!user}
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handlePollVote(msg.id, opt.id); 
                                    setActiveMsgId(null); 
                                    setCustomEmojiOpenForId(null); 
                                    setActiveReactionView(null); 
                                    setActiveActionsMsgId(null);
                                    setShowPollVotersForId(null);
                                  }}
                                  className={`relative w-full text-left overflow-hidden rounded-md px-2 py-1.5 transition-colors ${msg.userId === user?.uid ? 'hover:bg-indigo-600/50' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                >
                                   <div className={`absolute top-0 bottom-0 left-0 ${optionBg} opacity-20`} style={{ width: `${userHasVotedAny ? percent : 0}%` }}></div>
                                   <div className="relative flex justify-between items-center gap-2">
                                     <span className="flex items-center gap-1.5 text-sm">
                                       {showCorrect ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" /> : hasVoted ? <CheckSquare className="w-3.5 h-3.5 opacity-80 shrink-0" /> : <div className="w-3.5 h-3.5 border border-current rounded-sm opacity-40 shrink-0" />} 
                                       <span className={showCorrect ? 'font-bold text-emerald-600 dark:text-emerald-400' : (showIncorrect ? 'text-red-500 dark:text-red-400 line-through' : '')}>{opt.text}</span>
                                     </span>
                                     <span className="text-xs font-mono opacity-80 w-8 text-right shrink-0">{userHasVotedAny ? `${percent}%` : ''}</span>
                                   </div>
                                 </button>
                               )
                            })}
                          </div>
                          <div className="relative">
                            <div 
                              className="text-[10px] text-right mt-1.5 opacity-70 cursor-pointer hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowPollVotersForId(showPollVotersForId === msg.id ? null : msg.id);
                                setActiveMsgId(null);
                                setCustomEmojiOpenForId(null);
                                setActiveActionsMsgId(null);
                                setActiveReactionView(null);
                              }}
                            >
                              {msg.poll.options.reduce((acc: number, o: any) => acc + Object.keys(o.votes || {}).length, 0)} votes
                            </div>
                            {showPollVotersForId === msg.id && (
                              <div className="absolute top-6 right-0 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 p-3 max-h-60 overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
                                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">Voters</h4>
                                {msg.poll.options.map((opt: any) => {
                                   const voters = Object.entries(opt.votes || {});
                                   if (voters.length === 0) return null;
                                   return (
                                     <div key={opt.id} className="mb-3 last:mb-0">
                                       <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase truncate">{opt.text}</div>
                                       <div className="space-y-1.5">
                                         {voters.map(([uid, voteData]: [string, any]) => {
                                            const voterProfile = userMap[uid];
                                            const timestampMs = voteData?.timestamp || null;
                                            const dateStr = timestampMs ? new Date(timestampMs).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                                            
                                            return (
                                              <div key={uid} className="flex items-center gap-2">
                                                 <img src={voterProfile?.photoURL || `https://ui-avatars.com/api/?name=${voterProfile?.displayName || 'User'}`} className="w-5 h-5 rounded-full object-cover bg-slate-100 dark:bg-slate-700" alt="" />
                                                 <div className="flex flex-col min-w-0">
                                                   <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{voterProfile?.displayName || 'Unknown User'}</span>
                                                   {dateStr && <span className="text-[8px] sm:text-[9px] text-slate-400 dark:text-slate-500">{dateStr}</span>}
                                                 </div>
                                              </div>
                                            );
                                         })}
                                       </div>
                                     </div>
                                   );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {msg.reactions && Object.keys(msg.reactions).some(k => Object.keys(msg.reactions[k]).length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1.5 relative" onClick={e => { e.stopPropagation(); setActiveMsgId(null); setCustomEmojiOpenForId(null); setActiveActionsMsgId(null); setShowPollVotersForId(null); }}>
                          {Object.entries(msg.reactions).map(([emoji, votes]: [string, any]) => {
                             const cnt = Object.keys(votes).length;
                             if (cnt === 0) return null;
                             const hasVoted = user && votes[user.uid];
                             return (
                               <button
                                 key={emoji}
                                 onClick={() => { 
                                   if (activeReactionView === msg.id) {
                                     setActiveReactionView(null);
                                   } else {
                                     setActiveReactionView(msg.id); 
                                   }
                                 }}
                                 className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs shadow-sm transition-colors ${hasVoted ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
                               >
                                 <span>{emoji}</span><span>{cnt}</span>
                               </button>
                             )
                          })}
                          {activeReactionView === msg.id && (
                            <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Reactions</span>
                                <button onClick={() => setActiveReactionView(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"><X className="w-3 h-3"/></button>
                              </div>
                              <div className="max-h-40 overflow-y-auto custom-scrollbar p-1">
                                {Object.entries(msg.reactions).flatMap(([reactEmoji, reactVotes]: [string, any]) => 
                                  Object.keys(reactVotes).map(uid => {
                                    const profile = userMap[uid];
                                    const isMe = user?.uid === uid;
                                    return (
                                      <div key={`${reactEmoji}-${uid}`} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:bg-slate-700/50">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                          <div className="relative shrink-0">
                                            <img src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || 'U'}`} alt="" className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700" />
                                            <span className="absolute -bottom-1 -right-1 text-[10px] bg-white dark:bg-slate-800 rounded-full shadow-sm">{reactEmoji}</span>
                                          </div>
                                          <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{isMe ? 'You' : (profile?.displayName || 'Anonymous')}</span>
                                        </div>
                                        {isMe && (
                                          <button onClick={() => { handleChatReact(msg.id, reactEmoji); setActiveReactionView(null); }} className="text-[10px] text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 px-2 py-1 rounded transition-colors font-medium">Remove</button>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {activeMsgId === msg.id && (
                        <div className={`absolute -top-12 ${msg.userId === user?.uid ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 flex items-center gap-2 z-50 animate-in slide-in-from-bottom-2 fade-in whitespace-nowrap`} onClick={e => e.stopPropagation()}>
                          {['👍', '👎', '❤️', '🔥', '😕'].map(emoji => (
                             <button
                               key={emoji}
                               onClick={() => { handleChatReact(msg.id, emoji); setActiveMsgId(null); }}
                               className="text-xl hover:scale-125 transition-transform origin-bottom"
                             >
                               {emoji}
                             </button>
                          ))}
                          <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                          {customEmojiOpenForId === msg.id ? (
                            <form onSubmit={(e) => {
                               e.preventDefault();
                               if (customEmojiInput.trim()) {
                                 handleChatReact(msg.id, customEmojiInput.trim());
                               }
                               setCustomEmojiOpenForId(null);
                               setCustomEmojiInput('');
                               setActiveMsgId(null);
                            }} className="flex items-center gap-1">
                              <input 
                                type="text"
                                autoFocus
                                value={customEmojiInput}
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val.length <= 4) setCustomEmojiInput(val);
                                }}
                                className="w-10 px-1 py-0.5 text-center bg-slate-100 dark:bg-slate-900 border-none rounded text-lg focus:ring-1 focus:ring-indigo-500 custom-scrollbar"
                                placeholder="..." 
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomEmojiOpenForId(msg.id);
                                setCustomEmojiInput('');
                              }}
                              className="text-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors w-6 h-6 flex items-center justify-center font-bold"
                            >
                              +
                            </button>
                          )}
                        </div>
                      )}

                      {/* Action buttons wrapper */}
                      <div className={`absolute top-1/2 -translate-y-1/2 transition-opacity flex items-center gap-1.5 z-10 ${activeActionsMsgId === msg.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} ${msg.userId === user?.uid ? '-left-[4.5rem]' : '-right-[4.5rem]'}`}>
                         {msg.userId === user?.uid && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setEditingMessageId(msg.id); 
                                setNewMessage(msg.text === '📊 Poll' ? '' : msg.text);
                                if (msg.poll) {
                                  setShowPollMaker(true);
                                  setPollQuestion(msg.poll.question || '');
                                  setPollIsMulti(msg.poll.isMulti || false);
                                  let opts = [...msg.poll.options];
                                  while (opts.length < 2) opts.push({ id: Math.random().toString(), text: '', isCorrect: false, votes: {} });
                                  setPollOptions(opts);
                                } else {
                                  setShowPollMaker(false);
                                  setPollQuestion('');
                                  setPollOptions([{id: '1', text: '', isCorrect: false}, {id: '2', text: '', isCorrect: false}]);
                                  setPollIsMulti(false);
                                }
                                setActiveActionsMsgId(null);
                                setReplyingTo(null);
                              }} 
                              className={`p-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full shadow-sm hover:scale-110`} 
                              title="Edit message"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                         )}
                         {(msg.userId === user?.uid || isAdmin) && (
                         <button 
                           onClick={(e) => { 
                              e.stopPropagation(); 
                              handleDeleteMessage(msg.id, msg.userId); 
                              setActiveActionsMsgId(null);
                           }} 
                           className={`p-1.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full shadow-sm hover:scale-110`} 
                           title="Delete message"
                         >
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                         )}
                           <button 
                             onClick={(e) => { 
                                e.stopPropagation(); 
                                handlePinMessage(msg.id, msg.isPinned === true); 
                                setActiveActionsMsgId(null);
                             }} 
                             className={`p-1.5 ${msg.isPinned ? 'bg-amber-500 text-white' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'} rounded-full shadow-sm hover:scale-110`} 
                             title={msg.isPinned ? "Unpin message" : "Pin message"}
                           >
                             {msg.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                           </button>
                      </div>
                    </div>
                </div>
              </motion.div>
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
          {replyingTo && (
            <div className="absolute bottom-full mb-0 w-full left-0 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 p-2.5 px-4 flex justify-between items-center z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-indigo-500">
              <div className="flex flex-col text-xs pr-4 overflow-hidden">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  Replying to {replyingTo.userId === user?.uid ? 'You' : (userMap[replyingTo.userId]?.displayName || replyingTo.userName)}
                </span>
                <span className="text-slate-600 dark:text-slate-300 truncate mt-0.5">{replyingTo.text}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setReplyingTo(null)} 
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className={`p-3 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-end gap-2 ${replyingTo ? 'pt-2' : ''} relative`}>
            {editingMessageId ? (
               <button type="button" onClick={() => { setEditingMessageId(null); setNewMessage(''); }} className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                 <X className="w-5 h-5" />
               </button>
            ) : (
               <button type="button" onClick={() => setShowPollMaker(!showPollMaker)} className={`p-2.5 rounded-xl transition-colors ${showPollMaker ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                 <BarChart2 className="w-5 h-5" />
               </button>
            )}

            {showPollMaker && (
              <div className="absolute bottom-full left-0 right-0 mb-2 mx-3 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 fade-in z-20">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={pollIsMulti} onChange={e => setPollIsMulti(e.target.checked)} className="rounded text-indigo-600 cursor-pointer" /> Multi-select
                    </label>
                  </div>
                  <button type="button" onClick={() => setShowPollMaker(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X className="w-4 h-4"/></button>
                </div>
                <input 
                  type="text" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full mb-3 px-3 py-2 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 font-medium"
                />
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {pollOptions.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                       <button
                         type="button"
                         onClick={() => {
                            if (!pollIsMulti) {
                               setPollOptions(pollOptions.map(o => ({ ...o, isCorrect: o.id === opt.id ? !o.isCorrect : false })));
                            } else {
                               setPollOptions(pollOptions.map(o => o.id === opt.id ? { ...o, isCorrect: !o.isCorrect } : o));
                            }
                         }}
                         className={`p-1.5 rounded-md transition-colors ${opt.isCorrect ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40' : 'text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                         title="Mark as correct option"
                       >
                         <CheckCircle2 className="w-4 h-4" />
                       </button>
                       <input 
                         type="text" value={opt.text} onChange={e => setPollOptions(pollOptions.map(o => o.id === opt.id ? { ...o, text: e.target.value } : o))}
                         placeholder={`Option ${i+1}`}
                         className="flex-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                       />
                       {pollOptions.length > 2 && (
                         <button type="button" onClick={() => setPollOptions(pollOptions.filter(o => o.id !== opt.id))} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                       )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 10 && (
                  <button type="button" onClick={() => setPollOptions([...pollOptions, {id: Math.random().toString(), text:'', isCorrect:false}])} className="mt-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors inline-block px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30">+ Add Option</button>
                )}
              </div>
            )}
            <textarea 
              autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-form-type="x-dummy"
              spellCheck="false"
              name="chatMsg"
              id="chatMsg"
              maxLength={2000}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                    // Just let it add a new line, don't prevent default.
                    // Wait, inside a form, Enter in textarea does NOT submit by default.
                 }
              }}
              placeholder={editingMessageId ? "Edit message..." : (user ? "Type a message..." : "Sign in to chat")}
              disabled={!user || isSending}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-slate-800 dark:text-slate-200 resize-none min-h-[40px] max-h-[120px] overflow-y-auto"
              rows={1}
              onInput={(e) => {
                 const target = e.target as HTMLTextAreaElement;
                 target.style.height = 'auto';
                 target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <button 
              type="submit" 
              disabled={!user || (!newMessage.trim() && (!showPollMaker || !pollQuestion.trim() || pollOptions.filter(o => o.text.trim()).length < 2)) || isSending}
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
                        const user = userMap[m.userId!] || {} as Partial<UserProfile>;
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
