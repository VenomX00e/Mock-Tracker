import { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  collectionGroup,
  doc,
  getDoc,
  deleteDoc,
  onSnapshot, updateDoc, setDoc, addDoc,
  where
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { UserProfile, MockScore } from '../../types';
import { parseLocalDate } from '../../lib/utils';
import { getErrorMessage } from '../../lib/errorUtils';
import { useCacheStore } from '../../store/analyticsStore';

export interface PollOption {
  id: string;
  text: string;
  isCorrect?: boolean;
  votes?: Record<string, { timestamp: number }> | string[];
}

export interface PollData {
  question: string;
  isMulti?: boolean;
  options: PollOption[];
}

export const createCommunityPoll = async (
  user: any,
  question: string,
  options: (string | { id: string; text: string; isCorrect?: boolean })[],
  isMulti: boolean = false
) => {
  if (!user) throw new Error("User required to create poll");
  if (!question || question.trim().length === 0) throw new Error("Question is required");
  
  const formattedOptions: PollOption[] = options.map((opt, index) => {
    if (typeof opt === 'string') {
      return {
        id: (index + 1).toString(),
        text: opt.trim(),
        isCorrect: false,
        votes: {}
      };
    }
    return {
      id: opt.id || (index + 1).toString(),
      text: opt.text.trim(),
      isCorrect: !!opt.isCorrect,
      votes: {}
    };
  }).filter(o => o.text.length > 0);

  if (formattedOptions.length < 2) {
    throw new Error("At least 2 non-empty options are required");
  }

  const payload: any = {
    userId: user.uid,
    userName: user.displayName || 'Anonymous',
    userPhoto: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'A'}`,
    text: '',
    createdAt: Date.now(),
    isPoll: true,
    poll: {
      question: question.trim(),
      isMulti,
      options: formattedOptions
    }
  };

  return await addDoc(collection(db, 'community_chat'), payload);
};

export function useCommunityPosts(user: any, isAdmin: boolean, categoryId: string | undefined) {
  const cache = useCacheStore();
  const [allUsers, setAllUsers] = useState<UserProfile[]>(cache.allUsers || []);
  const sortConfig = cache.communitySortConfig;
  const setSortConfig = (v: any) => cache.updateCommunityCache({ communitySortConfig: v });
  const [feedLogs, setFeedLogs] = useState<any[]>(cache.feedLogs || []);
  const [allFeedMocks, setAllFeedMocks] = useState<any[]>(cache.allFeedMocks || []);
  const [loadingTop, setLoadingTop] = useState(cache.isCommunityCached ? false : true);
  const [loadingFeed, setLoadingFeed] = useState(cache.isCommunityCached ? false : true);
  const [daysVisible, setDaysVisible] = useState(1);
  const [userMap, setUserMap] = useState<Record<string, UserProfile>>(cache.userMap || {});
  const [deletedMocks, setDeletedMocks] = useState<MockScore[]>(cache.deletedMocks || []);
  const [chatMessages, setChatMessages] = useState<any[]>(cache.chatMessages || []);
  
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

  useEffect(() => {
    const timeLimit = Date.now() - 48 * 60 * 60 * 1000;
    
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
      cache.updateCommunityCache({ chatMessages: messages });
      
      const hasNewMessages = snap.docChanges().some(change => change.type === 'added');
      if (hasNewMessages || isFirstLoad.current) {
        setTimeout(() => {
           const chatDiv = document.getElementById('community-chat-scroll');
           if (chatDiv) {
             const isNearBottom = chatDiv.scrollHeight - chatDiv.scrollTop <= chatDiv.clientHeight + 150;
             if (isNearBottom || isFirstLoad.current) {
               chatDiv.scrollTo({ top: chatDiv.scrollHeight, behavior: 'smooth' });
             }
           }
           isFirstLoad.current = false;
        }, 100);
      }
    }, (error: any) => {
      if (error.code !== 'permission-denied') {
        console.warn("Chat subscription error:", error);
      }
    });

    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      // If we already have the cache for this category, we can optionally skip or fetch in background
      // To strictly prevent recalculation on mount for exact same category, we can check.
      // For now, always fetch to keep up to date, but the user sees cached data instantly.
      try {
        const q = query(
          collection(db, 'users'),
          orderBy('avgPercentile', 'desc'),
          limit(150)
        );
        const snap = await getDocs(q);
        const users = snap.docs.map(d => d.data() as UserProfile);
        
        users.forEach(u => {
           if (categoryId && categoryId !== 'All') {
               if (u.categoryStats) {
                   const cs = u.categoryStats[categoryId]?.allTime;
                   if (cs) {
                       u.avgPercentile = cs.avgPercentile || 0;
                       u.totalTests = cs.totalTests || 0;
                       u.avgAccuracy = cs.avgAccuracy || 0;
                       u.avgQuantPercentile = cs.avgQuantPercentile || 0;
                       u.avgReasoningPercentile = cs.avgReasoningPercentile || 0;
                       u.avgEnglishPercentile = cs.avgEnglishPercentile || 0;
                       u.avgGaPercentile = cs.avgGaPercentile || 0;
                       u.dynamicAverages = cs.dynamicAverages || {};
                   } else {
                       u.avgPercentile = 0;
                       u.totalTests = 0;
                       u.avgAccuracy = 0;
                       u.avgQuantPercentile = 0;
                       u.avgReasoningPercentile = 0;
                       u.avgEnglishPercentile = 0;
                       u.avgGaPercentile = 0;
                       u.dynamicAverages = {};
                   }
               } else if (u.categoryId === categoryId || (!u.categoryId && categoryId === 'banking')) {
                   // Fallback for old stats that haven't been mapped yet
                   u.dynamicAverages = u.dynamicAverages || {};
               } else {
                   u.avgPercentile = 0;
                   u.totalTests = 0;
                   u.avgAccuracy = 0;
                   u.avgQuantPercentile = 0;
                   u.avgReasoningPercentile = 0;
                   u.avgEnglishPercentile = 0;
                   u.avgGaPercentile = 0;
                   u.dynamicAverages = {};
               }
           }
        });

        users.sort((a, b) => (b.avgPercentile || 0) - (a.avgPercentile || 0));
        
        // Filter out banned/muted users from leaderboard
        let visibleUsers = users.filter((u) => !u.isBanned && !u.isMuted);
        
        const map: Record<string, UserProfile> = {};
        users.forEach(u => map[u.userId] = u);
        setUserMap(map);

        if (categoryId && categoryId !== 'All') {
          visibleUsers = visibleUsers.filter(u => u.categoryId === categoryId || (!u.categoryId && categoryId === 'banking') || (u.categoryStats && u.categoryStats[categoryId] && u.categoryStats[categoryId].allTime.totalTests > 0));
        }
        
        visibleUsers = visibleUsers.filter(u => u.totalTests > 0);

        const emailMap = new Map<string, UserProfile>();
        const finalVisibleUsers: UserProfile[] = [];
        for (const u of visibleUsers) {
           if (u.email) {
               if (!emailMap.has(u.email)) {
                   emailMap.set(u.email, u);
               } else {
                   const existing = emailMap.get(u.email)!;
                   if ((u.totalTests || 0) > (existing.totalTests || 0)) {
                       emailMap.set(u.email, u);
                   }
               }
           } else {
               finalVisibleUsers.push(u);
           }
        }
        for (const u of emailMap.values()) {
            finalVisibleUsers.push(u);
        }
        
        finalVisibleUsers.sort((a, b) => (b.avgPercentile || 0) - (a.avgPercentile || 0));

        setAllUsers(finalVisibleUsers);
        cache.updateCommunityCache({ allUsers: finalVisibleUsers, userMap: map });
      } catch (e) {
        console.error(e);
      }
      setLoadingTop(false);
    };
    fetchLeaderboard();
  }, [categoryId]);

  useEffect(() => {
    const fetchFeed = async () => {
      if (Object.keys(userMap).length === 0) return; // Wait for users to load
      if (feedLogs.length === 0) {
        setLoadingFeed(true);
      }
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
        
        if (isAdmin) {
           setDeletedMocks(mocks.filter(m => m.isDeleted === true));
        }

        mocks = mocks.filter(m => {
           if (m.isDeleted) return false;
           
           const p = userMap[m.userId!];
           if (categoryId && categoryId !== 'All') {
             const mockCat = m.categoryId || 'banking';
             const categoryMatch = mockCat === categoryId;
             if (!categoryMatch) return false;
           }

           if (!p) return true;
           if (p.isBanned || p.isMuted) return false;
           return true;
        });

        setAllFeedMocks(mocks);

        const profileToMocksMap: Record<string, MockScore[]> = {};
        mocks.forEach(m => {
          if (!profileToMocksMap[m.userId!]) profileToMocksMap[m.userId!] = [];
          profileToMocksMap[m.userId!].push(m);
        });
        
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
             userName: profile.displayName || m.userName || 'Anonymous',
             userStreak: userDateToStreakMap[key] || 1,
             userStreakActive: true,
             userPhoto: profile.photoURL || `https://ui-avatars.com/api/?name=${m.userName || 'A'}`,
             userProfileRef: { ...profile, todaysMocks: profileToMocksMap[m.userId!].filter(tm => parseLocalDate(tm.date).toDateString() === new Date().toDateString()) } as UserProfile
          });
        });

        const finalFeed = [];
        for (const date of Object.keys(grouped).sort((a,b) => new Date(b).getTime() - new Date(a).getTime())) {
          const examsObj = grouped[date];
          const examsArray = [];
          for (const examName of Object.keys(examsObj)) {
            const sortedMocks = examsObj[examName].sort((a: MockScore, b: MockScore) => b.percentile - a.percentile);
            const earliestTime = Math.min(...sortedMocks.map((m: MockScore) => parseLocalDate(m.date).getTime()));
            examsArray.push({ examName, mocks: sortedMocks, earliestTime });
          }
          examsArray.sort((a, b) => b.earliestTime - a.earliestTime);
          
          const universalRows: any[] = [];
          for (const eg of examsArray) {
             universalRows.push(...eg.mocks);
          }
          finalFeed.push({ date, mocks: universalRows });
        }
        setFeedLogs(finalFeed);
        // Only update cache if it's the initial load (daysVisible === 1) to avoid overriding with paginated data if we unmount
        if (daysVisible === 1) {
            cache.updateCommunityCache({ feedLogs: finalFeed, allFeedMocks: mocks, deletedMocks: deletedMocks });
        }
      } catch (e) {
        console.error(e);
      }
      setLoadingFeed(false);
    };
    fetchFeed();
  }, [daysVisible, userMap, categoryId]);

  return {
    allUsers, setAllUsers,
    feedLogs, setFeedLogs,
    allFeedMocks, setAllFeedMocks,
    loadingTop, setLoadingTop,
    loadingFeed, setLoadingFeed,
    userMap, setUserMap,
    deletedMocks, setDeletedMocks,
    chatMessages, setChatMessages,
    sortConfig, setSortConfig,
    daysVisible, setDaysVisible
  };
}


export function useCommunityUI(user: any, isAdmin: boolean, categoryId: string | undefined, activeCategory: any) {
  const {
    allUsers, setAllUsers,
    feedLogs, setFeedLogs,
    allFeedMocks, setAllFeedMocks,
    loadingTop, setLoadingTop,
    loadingFeed, setLoadingFeed,
    userMap, setUserMap,
    deletedMocks, setDeletedMocks,
    chatMessages, setChatMessages,
    sortConfig, setSortConfig,
    daysVisible, setDaysVisible
  } = useCommunityPosts(user, isAdmin, categoryId);

  const cache = useCacheStore();
  const selectedPhase = cache.communitySelectedPhase;
  const setSelectedPhase = (v: string) => cache.updateCommunityCache({ communitySelectedPhase: v });
  
  const selectedPeriod = cache.communitySelectedPeriod;
  const setSelectedPeriod = (v: string) => cache.updateCommunityCache({ communitySelectedPeriod: v });

  const [feedSort, setFeedSort] = useState<{ key: string | null, direction: 'asc'|'desc'|null }>({ key: null, direction: null });
  const [reactions, setReactions] = useState<Record<string, { count: number, hasReacted: boolean }>>({});
  const [showTrash, setShowTrash] = useState(false);
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
  

  const handleSendMessage = async (e?: React.FormEvent | string, directText?: string) => {
    if (e && typeof (e as any).preventDefault === 'function') {
      (e as any).preventDefault();
    }

    const messageText = typeof e === 'string' ? e : (directText || newMessage);
    const textTrimmed = (messageText || '').trim();
    const hasText = textTrimmed.length > 0;
    const hasPoll = showPollMaker && pollQuestion.trim().length > 0 && pollOptions.filter(o => o.text.trim().length > 0).length >= 2;
    if (!user || isSending || (!hasText && !hasPoll)) return;
    
    // UI Hardening: enforce maxLength on text as per DB rules
    if (textTrimmed.length > 2000) {
      setChatError(`Message cannot exceed 2000 characters.`);
      setTimeout(() => setChatError(''), 4000);
      return;
    }

    if (hasPoll && pollQuestion.trim().length > 200) {
      setChatError(`Poll question cannot exceed 200 characters.`);
      setTimeout(() => setChatError(''), 4000);
      return;
    }
    
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
          text: textTrimmed,
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
        text: textTrimmed,
        createdAt: Date.now()
      };

      if (hasPoll) {
        payload.isPoll = true;
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

      const validateChatMessage = (data: any) => {
        if (!data.userId) throw new Error("Missing user ID");
        if (data.userName && data.userName.length > 100) throw new Error("User name too long");
        if (data.userPhoto && data.userPhoto.length > 500) throw new Error("User photo URL too long");
        if (data.text && data.text.length > 2000) throw new Error("Message text too long");
        if (data.poll && data.poll.question && data.poll.question.length > 200) throw new Error("Poll question too long");
      };
      
      validateChatMessage(payload);

      await addDoc(collection(db, 'community_chat'), payload);
      try {
        await setDoc(doc(db, 'users', user.uid), { userId: user.uid, lastActiveAt: Date.now() }, { merge: true });
      } catch (e) { console.error(e); }
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
        setChatError(getErrorMessage(err));
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

  const availablePhases = useMemo(() => {
    // If we want all possible phases ever known statically, we can use a fixed list.
    // However, keeping consistent with Dashboard, we can use a global list or extract from feed.
    const phases = new Set<string>();
    feedLogs.forEach(day => {
        day.mocks?.forEach((m: any) => {
            if (m.examPhase) phases.add(m.examPhase);
        });
    });
    const catPhases = activeCategory?.phases || ['Prelims', 'Mains'];
    catPhases.forEach((p: string) => phases.add(p));
    
    const sortedPhases = Array.from(phases).sort((a, b) => {
      const idxA = catPhases.indexOf(a);
      const idxB = catPhases.indexOf(b);
      
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    
    return ['All', ...sortedPhases];
  }, [feedLogs]);

  const currentCommunityHash = useMemo(() => {
    const userHash = allUsers.length + '_' + allUsers.reduce((sum, u) => sum + (u.avgPercentile || 0), 0);
    const mockHash = allFeedMocks.length + '_' + allFeedMocks.reduce((sum, m: any) => sum + (m.likes?.length || 0), 0);
    return `${userHash}_${mockHash}_${selectedPhase}_${selectedPeriod}_${sortConfig.key}_${sortConfig.direction}_${categoryId}`;
  }, [allUsers, allFeedMocks, selectedPhase, selectedPeriod, sortConfig.key, sortConfig.direction, categoryId]);

  const activeAllUsers = useMemo(() => {
    if (cache.isCommunityCached && cache.communityHash === currentCommunityHash && cache.activeAllUsers?.length > 0) return cache.activeAllUsers;
    let users = allUsers;
    
    // Check if it's a known period
    const is30D = selectedPeriod === '30 Days' || selectedPeriod === 'Last 30 Days';
    const is7D = selectedPeriod === '7 Days' || selectedPeriod === 'Last 7 Days';
    const isAll = selectedPeriod === 'All Time' || selectedPeriod === 'All';
    const isCustom = !is30D && !is7D && !isAll;

    if (selectedPhase === 'All' && isAll) {
      // Nothing special doing, proceed to the regular filtering at the bottom
    } else {
      const userStats: Record<string, any> = {};
      
      let cutoffTime = 0;
      if (is30D) {
         const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - 30); cutoffTime = d.getTime();
      } else if (is7D) {
         const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - 7); cutoffTime = d.getTime();
      } else if (isCustom) {
         const parsed = parseInt(selectedPeriod);
         if (!isNaN(parsed) && parsed > 0) {
           const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - parsed); cutoffTime = d.getTime();
         }
      }

      allFeedMocks.forEach(m => {
         if (selectedPhase !== 'All' && m.examPhase !== selectedPhase) return;
         if (cutoffTime > 0) {
            const d = parseLocalDate(m.date);
            if (d.getTime() < cutoffTime) return;
         }
         const uid = m.userId;
         if (!uid) return;
         if (!userStats[uid]) {
            const u = userMap[uid] || {} as any;
            userStats[uid] = {
               ...u, 
               totalTests: 0,
               pCount: 0, pSum: 0,
               dynamicSums: {}
            };
         }
         const stat = userStats[uid];
         stat.totalTests++;
         
         if ((!m.examScope || m.examScope === 'Full') && m.percentile > 0) {
            stat.pSum += m.percentile; stat.pCount++;
         }
         
         const allSubs = { ...m, ...m.dynamicSubjects };
         Object.keys(allSubs).forEach(key => {
            const val = allSubs[key];
            if (val && typeof val === 'object' && val.percentile > 0) {
               if (!stat.dynamicSums[key]) stat.dynamicSums[key] = { sum: 0, count: 0 };
               stat.dynamicSums[key].sum += val.percentile;
               stat.dynamicSums[key].count++;
            }
         });
      });

      const finalizeStat = (stat: any) => {
         const finalObj = {
            ...stat,
            avgPercentile: stat.pCount > 0 ? Number((stat.pSum / stat.pCount).toFixed(2)) : 0,
            dynamicAverages: {} as Record<string, number>,
         };
         if (stat.dynamicSums) {
            Object.keys(stat.dynamicSums).forEach(k => {
               finalObj.dynamicAverages[k] = Number((stat.dynamicSums[k].sum / stat.dynamicSums[k].count).toFixed(2));
            });
            // Keep aliases for backward compatibility with existing hardcoded columns if needed
            finalObj.avgQuantPercentile = finalObj.dynamicAverages['quant'] || finalObj.dynamicAverages['bank_quant'] || finalObj.dynamicAverages['ssc_maths'] || 0;
            finalObj.avgReasoningPercentile = finalObj.dynamicAverages['reasoning'] || finalObj.dynamicAverages['bank_reasoning'] || finalObj.dynamicAverages['ssc_reasoning'] || 0;
            finalObj.avgEnglishPercentile = finalObj.dynamicAverages['english'] || finalObj.dynamicAverages['bank_english'] || finalObj.dynamicAverages['ssc_english'] || 0;
         }
         return finalObj;
      };

      if (selectedPhase === 'All') {
         users = allUsers.map(u => {
            const uid = u.userId;
            const catKey = categoryId !== 'All' ? categoryId : null;
            if (is30D) {
                if (catKey && u.categoryStats?.[catKey]?.stats30D) return { ...u, ...(u.categoryStats[catKey].stats30D) };
                if (!catKey && u.stats30D) return { ...u, ...u.stats30D };
            }
            if (is7D) {
                if (catKey && u.categoryStats?.[catKey]?.stats7D) return { ...u, ...(u.categoryStats[catKey].stats7D) };
                if (!catKey && u.stats7D) return { ...u, ...u.stats7D };
            }
            
            const stat = userStats[uid];
            if (!stat) return { ...u, totalTests: 0 };
            return finalizeStat(stat);
         }).filter(u => u.totalTests > 0);
      } else {
        users = Object.values(userStats).map((stat: any) => finalizeStat(stat)).filter((u: any) => u.avgPercentile > 0 || u.totalTests > 0);
      }
    }
    
    return users;
  }, [allUsers, allFeedMocks, selectedPhase, selectedPeriod, userMap]);

  const sortedLeaderboard = useMemo(() => {
    if (cache.isCommunityCached && cache.communityHash === currentCommunityHash && cache.sortedLeaderboard?.length > 0) return cache.sortedLeaderboard;
    return [...activeAllUsers].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0;
    
    let aVal;
    let bVal;
    if (sortConfig.key.includes('.')) {
      const parts = sortConfig.key.split('.');
      aVal = (a as Record<string, any>)[parts[0]]?.[parts[1]];
      bVal = (b as Record<string, any>)[parts[0]]?.[parts[1]];
    } else {
      aVal = (a as Record<string, any>)[sortConfig.key];
      bVal = (b as Record<string, any>)[sortConfig.key];
    }
    
    if (aVal == null) aVal = 0;
    if (bVal == null) bVal = 0;
    
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
  }, [activeAllUsers, sortConfig.key, sortConfig.direction, currentCommunityHash, cache]);

  const filteredFeedLogs = useMemo(() => {
    if (cache.isCommunityCached && cache.communityHash === currentCommunityHash && cache.communityFilteredFeedLogs?.length > 0) return cache.communityFilteredFeedLogs;
    if (selectedPhase === 'All') return feedLogs;
    return feedLogs.map(dg => ({
       ...dg,
       mocks: dg.mocks.filter((m: any) => m.examPhase === selectedPhase)
    })).filter(dg => dg.mocks.length > 0);
  }, [feedLogs, selectedPhase, currentCommunityHash, cache]);

  useEffect(() => {
    if (cache.communityHash !== currentCommunityHash) {
      cache.updateCommunityCache({
         communityHash: currentCommunityHash,
         activeAllUsers,
         sortedLeaderboard,
         communityFilteredFeedLogs: filteredFeedLogs
      });
    }
  }, [currentCommunityHash, activeAllUsers, sortedLeaderboard, filteredFeedLogs, cache]);



  const handleAdminRestore = async (mock: any) => {
    try {
      await updateDoc(doc(db, 'mocks', mock.id), { isDeleted: false });
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

  const handleReact = async (e: React.MouseEvent, mockId: string, mockUserId: string) => {
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
  };

  return {
    allUsers, setAllUsers, feedLogs, setFeedLogs, allFeedMocks, setAllFeedMocks, loadingTop, setLoadingTop,
    loadingFeed, setLoadingFeed, userMap, setUserMap, deletedMocks, setDeletedMocks, chatMessages, setChatMessages,
    sortConfig, setSortConfig, daysVisible, setDaysVisible,
    
    feedSort, setFeedSort, selectedPhase, setSelectedPhase, selectedPeriod, setSelectedPeriod, reactions, setReactions,
    showTrash, setShowTrash, newMessage, setNewMessage, editingMessageId, setEditingMessageId, replyingTo, setReplyingTo,
    activeMsgId, setActiveMsgId, activeActionsMsgId, setActiveActionsMsgId, showPollVotersForId, setShowPollVotersForId,
    chatError, setChatError, isSending, setIsSending, showPollMaker, setShowPollMaker, pollQuestion, setPollQuestion,
    pollOptions, setPollOptions, pollIsMulti, setPollIsMulti, activeReactionView, setActiveReactionView,
    customEmojiOpenForId, setCustomEmojiOpenForId, customEmojiInput, setCustomEmojiInput, chatBottomRef,
    
    handleSendMessage, handleDeleteMessage, handlePinMessage, handleChatReact, handlePollVote, handleSort, handleFeedSort,
    getFeedSortConfig, availablePhases, activeAllUsers, sortedLeaderboard, filteredFeedLogs, handleAdminRestore,
    handleAdminPermanentDelete, handleAdminChangeGlobalSort, handleReact, createCommunityPoll
  };
}
