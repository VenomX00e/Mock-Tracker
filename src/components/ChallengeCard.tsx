import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, query, collection, getDocs, updateDoc } from 'firebase/firestore';
import { useAuth } from '../services/AuthContext';
import { Check, CheckCircle2, Circle, Users, Flame, CalendarDays, X, MoreVertical, Pin, PinOff } from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';

import { useMocks } from '../hooks/useMocks';

import { Edit2, Trash2 } from 'lucide-react';
import { ChallengeParticipantsDialog } from './ChallengeParticipantsDialog';

interface ChallengeProps {
  challenge: any;
  onEdit?: (challenge: any) => void;
  onDelete?: (challenge: any) => void;
  onDismiss?: (challengeId: string) => void;
  onPin?: (challenge: any) => void;
  isAdmin?: boolean;
}

export function ChallengeCard({ challenge, onEdit, onDelete, onDismiss, onPin, isAdmin }: ChallengeProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { mocks } = useMocks();
  const [participant, setParticipant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const [showUsers, setShowUsers] = useState(false);
  const [usersTab, setUsersTab] = useState<'standings' | 'activity' | 'award'>('activity');

  useEffect(() => {
    if (user && challenge.id) {
      fetchParticipantData();
      fetchParticipantsCount();
    }
  }, [user, challenge.id]);

  const fetchParticipantData = async () => {
    try {
      const docRef = doc(db, 'challenges', challenge.id, 'participants', user!.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setParticipant(docSnap.data());
      }
    } catch (error: any) {
      if (error.code !== 'permission-denied') {
        console.error(error);
      }
    }
    setLoading(false);
  };

  const userCache = React.useRef<Record<string, { displayName: string, photoURL: string }>>({});

  const fetchParticipantsCount = async () => {
     try {
       const snap = await getDocs(query(collection(db, 'challenges', challenge.id, 'participants')));
       setParticipantsCount(snap.size);
       const ptsPromises = snap.docs.map(async (d) => {
         const p = d.data();
         const uid = p.userId;
         if (userCache.current[uid]) {
            p.displayName = userCache.current[uid].displayName || p.displayName;
            p.photoURL = userCache.current[uid].photoURL || p.photoURL;
         } else {
            try {
              const uDoc = await getDoc(doc(db, 'users', uid));
              if (uDoc.exists()) {
                 const uData = uDoc.data();
                 userCache.current[uid] = { displayName: uData.displayName, photoURL: uData.photoURL };
                 if (uData.displayName) p.displayName = uData.displayName;
                 if (uData.photoURL) p.photoURL = uData.photoURL;
              }
            } catch(e) {}
         }
         return p;
       });
       const resolvedPts = await Promise.all(ptsPromises);

       // Sort by streak (highest first) or recent check-ins
       const hasTasks = challenge.tasks && challenge.tasks.length > 0;
       const isDaily = hasTasks && challenge.todoFrequency !== 'oneTime';
       const getTaskCount = (p: any) => isDaily ? (p.activities?.filter((a: any) => a.type === 'task').length || 0) : (p.completedTasks?.length || 0);
       
       resolvedPts.sort((a,b) => ((b.streak || 0) - (a.streak || 0)) || ((b.checkInDates?.length || 0) - (a.checkInDates?.length || 0)) || (hasTasks ? (getTaskCount(b) - getTaskCount(a)) : ((b.totalMocks || 0) - (a.totalMocks || 0))));
       setParticipants(resolvedPts);
     } catch(e){}
  }

  const joinChallenge = async () => {
    if (!user) return;
    try {
      const payload = {
        userId: user.uid,
        displayName: profile?.displayName || user.displayName || 'User',
        photoURL: profile?.photoURL || user.photoURL || '',
        joinedAt: new Date().toISOString(),
        streak: 0,
        lastCheckInDate: '',
        checkInDates: [],
        checkInTimes: {}
      };
      await setDoc(doc(db, 'challenges', challenge.id, 'participants', user.uid), payload);
      setParticipant(payload);
      fetchParticipantsCount();
    } catch (e) {
      console.error(e);
      alert('Failed to join');
    }
  };

  const checkCompletion = async (participantState: any) => {
   if (!challenge.badge) return;
   if (participantState.awardedBadge) return;
   if (!user) return;
   
   let isCompleted = false;
   if (challenge.challengeType === 'streak') {
     if (participantState.streak >= challenge.durationDays || (participantState.checkInDates && participantState.checkInDates.length >= challenge.durationDays)) {
        isCompleted = true;
     }
   } else if (challenge.challengeType === 'uploadMock') {
     if (participantState.totalMocks >= challenge.durationDays) {
        isCompleted = true;
     }
   } else if (challenge.challengeType === 'todo') {
     const hasTasks = challenge.tasks && challenge.tasks.length > 0;
     if (hasTasks) {
       if (challenge.todoFrequency === 'oneTime') {
         if (participantState.completedTasks && participantState.completedTasks.length >= challenge.tasks.length) {
            isCompleted = true;
         }
       } else { 
         if (participantState.streak >= challenge.durationDays || (participantState.checkInDates && participantState.checkInDates.length >= challenge.durationDays)) {
            isCompleted = true;
         }
       }
     }
   }

   if (isCompleted) {
       try {
           const userDocRef = doc(db, 'users', user.uid);
           const pDocRef = doc(db, 'challenges', challenge.id, 'participants', user.uid);
           
           const snapshot = await getDoc(userDocRef);
           if (snapshot.exists()) {
              const data = snapshot.data();
              const existingBadges = data.badges || [];
              const badgeId = `${challenge.id}_badge`;
              
              if (!existingBadges.some((b:any) => b.id === badgeId)) {
                  const newBadge = {
                      id: badgeId,
                      ...challenge.badge,
                      awardedAt: new Date().toISOString(),
                      challengeId: challenge.id,
                      challengeTitle: challenge.title
                  };
                  await updateDoc(userDocRef, { badges: [...existingBadges, newBadge] });
              }
           }
           await updateDoc(pDocRef, { awardedBadge: true });
           setParticipant((prev:any) => prev ? { ...prev, awardedBadge: true } : prev);
       } catch(e) {
           console.error("Failed to grant badge", e);
       }
   }
  };

  const checkIn = async () => {
    if (!user || !participant) return;
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      if (participant.checkInDates?.includes(today)) return; // Already checked in

      // Very simple streak calculation: 
      let newStreak = participant.streak || 0;
      if (participant.lastCheckInDate) {
        const last = new Date(participant.lastCheckInDate);
        const curr = new Date(today);
        const diff = Math.floor((curr.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
           newStreak += 1;
        } else if (diff > 1) {
           newStreak = 1; // reset streak if missed a day
        }
      } else {
        newStreak = 1;
      }

      const newCheckIns = [...(participant.checkInDates || []), today];
      const newCheckInTimes = { ...(participant.checkInTimes || {}), [today]: now.toISOString() };
      
      const payload = {
        streak: newStreak,
        lastCheckInDate: today,
        checkInDates: newCheckIns,
        checkInTimes: newCheckInTimes,
        displayName: profile?.displayName || user.displayName || 'User',
        photoURL: profile?.photoURL || user.photoURL || '',
        updatedAt: now.toISOString()
      };
      
      await updateDoc(doc(db, 'challenges', challenge.id, 'participants', user.uid), payload);
      const newState = { ...participant, ...payload };
      setParticipant(newState);
      checkCompletion(newState);
      fetchParticipantsCount();
    } catch (e) {
      console.error("Error check in", e);
      alert("Check in failed");
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const hasCheckedInToday = participant?.checkInDates?.includes(today);

  useEffect(() => {
    if (challenge.challengeType === 'uploadMock' && participant && !hasCheckedInToday) {
      if (mocks && mocks.some(m => new Date(m.date).toISOString().split('T')[0] === today)) {
        checkIn();
      }
    }
  }, [mocks, participant, challenge.challengeType, hasCheckedInToday, today]);

  useEffect(() => {
    if (challenge.challengeType === 'uploadMock' && participant && mocks && user) {
      if (participant.userId !== user.uid) return;
      
      const startDayStr = challenge.startDate ? challenge.startDate.split('T')[0] : null;
      let total = 0;
      const daily: Record<string, number> = {};
      
      mocks.forEach(m => {
        const d = new Date(m.date).toISOString().split('T')[0];
        if (!startDayStr || d >= startDayStr) {
           daily[d] = (daily[d] || 0) + 1;
           total++;
        }
      });
      
      const prevTotal = participant.totalMocks || 0;
      const prevDaily = participant.dailyMocks || {};
      
      if (prevTotal !== total || JSON.stringify(prevDaily) !== JSON.stringify(daily)) {
         updateDoc(doc(db, 'challenges', challenge.id, 'participants', user.uid), {
            totalMocks: total,
            dailyMocks: daily
         }).then(() => {
            const newState = { ...participant, totalMocks: total, dailyMocks: daily };
            setParticipant(newState);
            checkCompletion(newState);
            setParticipants(prev => prev.map(p => p.userId === user.uid ? { ...p, totalMocks: total, dailyMocks: daily } : p));
         }).catch(console.error);
      }
    }
  }, [mocks, participant?.totalMocks, participant?.dailyMocks, participant?.userId, challenge, user]);

  if (loading) return <div className="p-4 bg-white/50 animate-pulse rounded-2xl h-24"></div>;

  const getDaysLeft = () => {
    if (!challenge.startDate || !challenge.durationDays) return null;
    const start = new Date(challenge.startDate).getTime();
    const now = new Date().getTime();
    const elapsedDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    const left = challenge.durationDays - elapsedDays;
    return left > 0 ? left : 0;
  };

  const getDayNumber = () => {
    if (!challenge.startDate) return null;
    const start = new Date(challenge.startDate.split('T')[0]).getTime();
    const now = new Date(today).getTime();
    const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : null;
  };

  const currentDay = getDayNumber();

  const getGroupedCheckIns = () => {
    const groups: { [date: string]: any[] } = {};
    for (const p of participants) {
      if (p.checkInDates && challenge.challengeType !== 'todo') {
        for (const date of p.checkInDates) {
          if (!groups[date]) groups[date] = [];
          groups[date].push({
            ...p,
            type: 'checkIn',
            timeCheckedIn: p.checkInTimes ? p.checkInTimes[date] : null
          });
        }
      } 
      
      if (p.activities && p.activities.length > 0) {
         const seenTasks = new Set();
         for (const act of p.activities) {
            const date = act.date;
            const uniqueKey = `${p.uid}-${date}-${act.taskId || act.taskName}`;
            if (seenTasks.has(uniqueKey)) continue;
            seenTasks.add(uniqueKey);

            if (!groups[date]) groups[date] = [];
            groups[date].push({
               ...p,
               type: 'task',
               taskName: act.taskName,
               timeCheckedIn: act.timestamp
            });
         }
      }
      // Fallback for checkIns without activity logs (legacy support)
      if (challenge.challengeType === 'todo' && p.checkInDates && (!p.activities || p.activities.length === 0)) {
         for (const date of p.checkInDates) {
            if (!groups[date]) groups[date] = [];
            groups[date].push({
                ...p,
                type: 'checkIn',
                timeCheckedIn: p.checkInTimes ? p.checkInTimes[date] : null
            });
         }
      }
    }
    // Sort items within each day by reversed chronological order
    for (const date in groups) {
      groups[date].sort((a,b) => (b.timeCheckedIn ? new Date(b.timeCheckedIn).getTime() : 0) - (a.timeCheckedIn ? new Date(a.timeCheckedIn).getTime() : 0));
    }
    return Object.entries(groups).sort((a,b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  };

  const groupedCheckIns = getGroupedCheckIns();

  return (
    <div className="bg-gradient-to-br from-indigo-50/80 to-white dark:from-slate-800/80 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md flex flex-col h-full">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
      
      <div className={`flex justify-between items-start mb-4 relative z-10`}>
        <div className="pr-2 flex-grow">
          <div className="flex items-start justify-between cursor-pointer relative min-h-[28px]" onClick={() => setShowActions(!showActions)}>
            <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2 leading-tight flex-wrap pr-32">
              <Flame className="w-5 h-5 text-orange-500 shrink-0" />
              <span className="truncate">{challenge.title}</span>
              {currentDay !== null && (
                 <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full ml-1 whitespace-nowrap">
                    Day {currentDay}
                 </span>
              )}
            </h4>
            {showActions && (
              <div className="flex items-center gap-1 shrink-0 absolute right-0 top-0 pb-1" onClick={e => e.stopPropagation()}>
                {isAdmin && onPin && (
                  <button onClick={(e) => { e.stopPropagation(); onPin(challenge); }} className={`p-1.5 ${challenge.isPinned ? 'text-white bg-amber-500 hover:bg-amber-600' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30'} rounded-md transition-colors`} title={challenge.isPinned ? "Unpin Challenge" : "Pin Challenge"}>
                    {challenge.isPinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                )}
                {(isAdmin || challenge.creatorId === user?.uid) && onEdit && (
                  <button onClick={(e) => { e.stopPropagation(); onEdit(challenge); }} className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors" title="Edit Challenge">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {(isAdmin || challenge.creatorId === user?.uid) && onDelete && (
                  <button onClick={(e) => { e.stopPropagation(); onDelete(challenge); }} className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors" title="Delete Challenge">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDismiss && (
                  <button onClick={(e) => { e.stopPropagation(); onDismiss(challenge.id); }} className="p-1.5 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors" title="Hide Challenge">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{challenge.description}</p>
        </div>
        {participant && (
          <div className="flex flex-col items-end shrink-0 ml-3">
            <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-md flex items-center gap-1 border border-orange-100 dark:border-orange-800/30 font-bold text-xs mt-0.5">
              <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
              {participant.streak} Day
            </div>
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap items-center gap-3 mt-2 relative z-10 w-full justify-between">
        <div 
          className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 py-1.5 px-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors max-w-full overflow-hidden" 
          onClick={() => setShowUsers(!showUsers)}
        >
          <div className="flex -space-x-2 shrink-0">
            {participants.slice(0, 5).map((p, i) => (
               <img key={i} src={p.photoURL || `https://ui-avatars.com/api/?name=${p.displayName}`} alt={p.displayName} title={`${p.displayName} (${p.streak} day streak)`} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-800" referrerPolicy="no-referrer" />
            ))}
          </div>
          <div className="flex items-center gap-1 shrink-0" title={`${participantsCount} participants`}>
            <Users className="w-3.5 h-3.5" />
            <span>{participantsCount}</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 hidden sm:block"></div>
          <div className="items-center gap-1 shrink-0 hidden sm:flex" title={`${challenge.durationDays || 'N'} Days Duration`}>
             <CalendarDays className="w-3.5 h-3.5" />
             <span className="truncate max-w-[80px] sm:max-w-none">{getDaysLeft() !== null ? `${getDaysLeft()}d left` : challenge.durationDays ? `${challenge.durationDays}d` : 'On'}</span>
          </div>
        </div>

        {!participant ? (
          <button onClick={joinChallenge} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors shadow-sm active:scale-95 shrink-0 ml-auto">
            Join
          </button>
        ) : challenge.challengeType === 'todo' ? null : challenge.challengeType !== 'uploadMock' ? (
          <button 
            onClick={checkIn} 
            disabled={hasCheckedInToday}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 border shrink-0 ml-auto ${hasCheckedInToday ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-transparent cursor-not-allowed' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/50'}`}
          >
            {hasCheckedInToday ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            {hasCheckedInToday ? 'Checked' : 'Check-In'}
          </button>
        ) : (
          hasCheckedInToday ? (
            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-bold border shrink-0 ml-auto bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-transparent">
              <CheckCircle2 className="w-4 h-4" />
              Checked
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-bold border shrink-0 ml-auto bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400">
              Give a Mock
            </div>
          )
        )}
      </div>

      {challenge.tasks && challenge.tasks.length > 0 && (
        <div className="mt-4 pt-3 border-t border-indigo-100 dark:border-indigo-900/30">
          <div className="space-y-2">
            {challenge.tasks.map((task: any) => {
               const isDaily = challenge.todoFrequency !== 'oneTime';
               const nowForCheck = new Date();
               const todayStrCheck = nowForCheck.toISOString().split('T')[0];
               
               const isCompleted = isDaily 
                 ? participant?.activities?.some((a: any) => a.taskId === task.id && a.date === todayStrCheck) 
                 : participant?.completedTasks?.includes(task.id);
                 
                return (
                 <div key={task.id} className="flex items-start gap-2 group p-1 -ml-1 rounded-lg transition-colors">
                   <button
                     disabled={!participant}
                     onClick={async (e) => {
                       e.stopPropagation();
                       if (!participant || !user) return;
                       const comp = participant.completedTasks || [];
                       const now = new Date();
                       const todayStr = now.toISOString().split('T')[0];
                       let newActivities = participant.activities ? [...participant.activities] : [];
                       let newComp = [...comp];

                       if (isDaily) {
                          if (isCompleted) {
                             newActivities = newActivities.filter(a => !(a.taskId === task.id && a.date === todayStr));
                          } else {
                             newActivities.push({
                               id: Math.random().toString(36).substring(2,9),
                               type: 'task',
                               taskId: task.id,
                               taskName: task.text,
                               timestamp: now.toISOString(),
                               date: todayStr
                             });
                          }
                       } else {
                          if (isCompleted) {
                             newComp = newComp.filter((id: string) => id !== task.id);
                             newActivities = newActivities.filter(a => a.taskId !== task.id);
                          } else {
                             newComp.push(task.id);
                             newActivities.push({
                               id: Math.random().toString(36).substring(2,9),
                               type: 'task',
                               taskId: task.id,
                               taskName: task.text,
                               timestamp: now.toISOString(),
                               date: todayStr
                             });
                          }
                       }

                       const payloadToUpdate: any = { 
                           completedTasks: newComp,
                           activities: newActivities
                       };
                       
                       let newParticipantState = { ...participant, ...payloadToUpdate };

                       // If checking a task and hasn't checked in today, update checkIn properties
                       if (!isCompleted && !hasCheckedInToday) {
                          let newStreak = participant.streak || 0;
                          if (participant.lastCheckInDate) {
                            const last = new Date(participant.lastCheckInDate);
                            const curr = new Date(todayStr);
                            const diff = Math.floor((curr.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
                            if (diff === 1) {
                               newStreak += 1;
                            } else if (diff > 1) {
                               newStreak = 1;
                            }
                          } else {
                            newStreak = 1;
                          }
                          
                          const newCheckIns = [...(participant.checkInDates || []), todayStr];
                          const newCheckInTimes = { ...(participant.checkInTimes || {}), [todayStr]: now.toISOString() };
                          
                          payloadToUpdate.streak = newStreak;
                          payloadToUpdate.lastCheckInDate = todayStr;
                          payloadToUpdate.checkInDates = newCheckIns;
                          payloadToUpdate.checkInTimes = newCheckInTimes;
                          
                          newParticipantState = { ...newParticipantState, ...payloadToUpdate };
                       }

                       try {
                         await updateDoc(doc(db, 'challenges', challenge.id, 'participants', user.uid), payloadToUpdate);
                         setParticipant(newParticipantState);
                         checkCompletion(newParticipantState);
                       } catch(err) {
                         console.error(err);
                       }
                     }}
                     className={`mt-0.5 shrink-0 rounded flex items-center justify-center w-5 h-5 transition-colors ${isCompleted ? 'bg-emerald-500 border-none' : 'border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500'} ${!participant ? 'opacity-50 cursor-not-allowed' : ''}`}
                   >
                     {isCompleted && <Check className="w-3.5 h-3.5 text-white" />}
                   </button>
                   <span className={`text-sm ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                     {task.text}
                   </span>
                 </div>
               );
            })}
          </div>
        </div>
      )}

      <ChallengeParticipantsDialog
        showUsers={showUsers}
        setShowUsers={setShowUsers}
        usersTab={usersTab}
        setUsersTab={setUsersTab}
        participants={participants}
        groupedCheckIns={groupedCheckIns}
        challenge={challenge}
        user={user}
        today={today}
      />
    </div>
  );
}
