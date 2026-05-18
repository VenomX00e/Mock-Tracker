import React, { useState } from 'react';
import { Users, X, Flame, CheckCircle2 } from 'lucide-react';

export interface ChallengeParticipantsDialogProps {
  showUsers: boolean;
  setShowUsers: (val: boolean) => void;
  usersTab: 'standings' | 'activity' | 'award';
  setUsersTab: (val: 'standings' | 'activity' | 'award') => void;
  participants: any[];
  groupedCheckIns: any[];
  challenge: any;
  user: any;
  today: string;
  isOwner?: boolean;
}

export const ChallengeParticipantsDialog: React.FC<ChallengeParticipantsDialogProps> = ({
  showUsers,
  setShowUsers,
  usersTab,
  setUsersTab,
  participants,
  groupedCheckIns,
  challenge,
  user,
  today,
  isOwner
}) => {
  const [awardName, setAwardName] = useState('');
  const [awardEmoji, setAwardEmoji] = useState('🏆');
  const [awardColor, setAwardColor] = useState('text-yellow-600');
  const [awardBg, setAwardBg] = useState('bg-yellow-100');
  const [awardBorder, setAwardBorder] = useState('border-yellow-200');
  const [awardTarget, setAwardTarget] = useState<'all' | 'completed'>('completed');
  const [awarding, setAwarding] = useState(false);

  const getEligibleParticipants = () => {
    if (awardTarget === 'all') return participants;
    return participants.filter(p => {
       const duration = challenge.durationDays || 0;
       if (challenge.challengeType === 'streak') {
         return (p.streak >= duration) || (p.checkInDates && p.checkInDates.length >= duration);
       } else if (challenge.challengeType === 'uploadMock') {
         return p.totalMocks >= duration;
       } else if (challenge.challengeType === 'todo') {
         if (challenge.todoFrequency === 'oneTime') {
           return p.completedTasks && challenge.tasks && p.completedTasks.length >= challenge.tasks.length;
         } else {
           return (p.streak >= duration) || (p.checkInDates && p.checkInDates.length >= duration);
         }
       }
       return false;
    });
  };

  const handleAwardBadges = async () => {
    if (!user || user.email !== 'mrityunjoyk29@gmail.com') return;
    if (!awardName.trim()) {
      alert("Please provide a badge name.");
      return;
    }

    const eligible = getEligibleParticipants();
    if (eligible.length === 0) {
      alert("No eligible participants found.");
      return;
    }

    setAwarding(true);
    let successCount = 0;
    try {
      const { updateDoc, doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../services/firebase');
      
      const newBadge = {
        id: `${challenge.id}_custom_badge_${Date.now()}`,
        text: awardName,
        emoji: awardEmoji,
        color: awardColor,
        bg: awardBg,
        border: awardBorder,
        awardedAt: new Date().toISOString(),
        challengeId: challenge.id,
        challengeTitle: challenge.title
      };

      for (const p of eligible) {
        try {
          const userDocRef = doc(db, 'users', p.userId);
          const snapshot = await getDoc(userDocRef);
          if (snapshot.exists()) {
             const data = snapshot.data();
             const existingBadges = data.badges || [];
             await updateDoc(userDocRef, { badges: [...existingBadges, newBadge] });
             successCount++;
          }
        } catch (e) {
          console.error("Error awarding to", p.userId, e);
        }
      }
      alert(`Successfully awarded badge to ${successCount} participants!`);
      setAwardName('');
    } catch (e) {
      console.error(e);
      alert("Error awarding badges.");
    }
    setAwarding(false);
  };

  if (!showUsers) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 ">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-0">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Challenge Participants
          </h3>
          <button onClick={() => setShowUsers(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setUsersTab('standings')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${usersTab === 'standings' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          >
            Standings
          </button>
          <button
            onClick={() => setUsersTab('activity')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${usersTab === 'activity' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          >
            Recent Activity
          </button>
          {(isOwner || user?.email === 'mrityunjoyk29@gmail.com') && (
            <button
              onClick={() => setUsersTab('award')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${usersTab === 'award' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
            >
              Award Batch
            </button>
          )}
        </div>

        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/50">
          {usersTab === 'standings' && (
            <div className="space-y-3">
              {participants.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No participants yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {[...participants].sort((a,b) => {
                     const hasTasks = challenge.tasks && challenge.tasks.length > 0;
                     const isDaily = hasTasks && challenge.todoFrequency !== 'oneTime';
                     const getTaskCount = (p: any) => isDaily ? (p.activities?.filter((a: any) => a.type === 'task').length || 0) : (p.completedTasks?.length || 0);
                     return ((b.streak || 0) - (a.streak || 0)) || ((b.checkInDates?.length || 0) - (a.checkInDates?.length || 0)) || (hasTasks ? (getTaskCount(b) - getTaskCount(a)) : ((b.totalMocks || 0) - (a.totalMocks || 0)));
                  }).map((p, i) => (
                     <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group">
                        <div className="flex items-center gap-4">
                           {i < 3 ? (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : i === 1 ? 'bg-slate-200 text-slate-600 dark:bg-slate-600/50 dark:text-slate-300' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                {i + 1}
                              </div>
                           ) : (
                              <div className="w-8 h-8 flex items-center justify-center font-bold text-slate-400 dark:text-slate-500 text-sm">{i + 1}</div>
                           )}
                           <img src={p.photoURL || `https://ui-avatars.com/api/?name=${p.displayName}`} alt={p.displayName} className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm" referrerPolicy="no-referrer" />
                           <div>
                             <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                               {p.displayName}
                               {user && p.userId === user.uid && <span className="ml-2 text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full dark:bg-indigo-900/50 dark:text-indigo-300">YOU</span>}
                             </p>
                             <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                               {p.checkInDates?.length || 0} total check-ins
                             </p>
                           </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                           <div className={`flex text-lg items-center gap-1.5 font-bold px-3 py-1.5 rounded-lg border ${p.checkInDates?.includes(today) ? 'text-orange-600 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400 border-orange-100 dark:border-orange-500/20' : 'text-slate-400 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-500 border-slate-200 dark:border-slate-700/50 opacity-60'}`}>
                             <Flame className={`w-5 h-5 ${p.checkInDates?.includes(today) ? 'text-orange-500' : 'text-slate-400 dark:text-slate-500'}`} />
                             {p.streak}
                           </div>
                           {challenge.tasks && challenge.tasks.length > 0 && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                                {challenge.todoFrequency === 'oneTime' ? (
                                  <>{p.completedTasks?.length || 0} {(p.completedTasks?.length || 0) === 1 ? 'task' : 'tasks'} done</>
                                ) : (
                                  <>{p.activities?.filter((a: any) => a.type === 'task').length || 0} task completions</>
                                )}
                              </p>
                           )}
                           {challenge.challengeType === 'uploadMock' && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                                {p.totalMocks || p.checkInDates?.length || 0} {(p.totalMocks || p.checkInDates?.length || 0) > 1 ? 'mocks' : 'mock'} taken
                              </p>
                           )}
                        </div>
                     </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {usersTab === 'activity' && (
            groupedCheckIns.length === 0 ? (
               <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No recent activity.</p>
            ) : (
               groupedCheckIns.map(([date, usersInfo]) => {
                 const dObj = new Date(date);
                 const isToday = dObj.toISOString().split('T')[0] === today;
                 const displayDate = isToday ? 'Today' : dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
               
               let dayLabel = '';
               if (challenge.startDate) {
                 const startStart = new Date(challenge.startDate.split('T')[0]).getTime();
                 const currDate = new Date(date).getTime();
                 const diffDays = Math.floor((currDate - startStart) / (1000 * 60 * 60 * 24)) + 1;
                 if (diffDays > 0) {
                    dayLabel = `Day ${diffDays}`;
                 }
               }

               return (
                 <div key={date} className="mb-6 last:mb-0 relative">
                    <div className="flex items-center gap-3 mb-4 sticky top-0 bg-white/90 dark:bg-slate-900/90  pb-2 pt-1 z-10">
                      <h5 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-500/20">
                        {dayLabel || 'Day'}
                      </h5>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{displayDate}</span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                    </div>
                    
                    <ul className="space-y-3">
                       {usersInfo.map((u: any, i: number) => (
                          <li key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group">
                             <div className="flex items-center gap-3">
                                <div className="relative">
                                  <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} alt={u.displayName} className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm" referrerPolicy="no-referrer" />
                                  {u.timeCheckedIn && (
                                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{u.displayName}</p>
                                  {u.timeCheckedIn && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                      {u.type === 'task' ? (
                                         <>Completed <span className="font-bold text-slate-700 dark:text-slate-300">"{u.taskName}"</span> at {new Date(u.timeCheckedIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                                      ) : (
                                         <>Checked in at {new Date(u.timeCheckedIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                                      )}
                                    </p>
                                  )}
                                </div>
                             </div>
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex text-sm items-center gap-1.5 font-bold text-orange-600 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-500/20">
                                  <Flame className="w-4 h-4 text-orange-500" />
                                  {u.streak}
                                </div>
                                {challenge.challengeType === 'uploadMock' && (
                                   <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                                     {u.dailyMocks?.[date] || 1} {(u.dailyMocks?.[date] || 1) > 1 ? 'mocks' : 'mock'} taken
                                   </p>
                                )}
                             </div>
                          </li>
                       ))}
                    </ul>
                 </div>
               );
             })
            )
          )}

          {usersTab === 'award' && (
            <div className="space-y-4">
               <h4 className="font-semibold text-slate-800 dark:text-slate-200">Award Batch to All Participants</h4>
               <p className="text-sm text-slate-500 dark:text-slate-400">
                 Create a custom badge to reward everyone who participated in this challenge from start to end.
               </p>
               <div className="space-y-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Badge Name</label>
                    <input type="text" value={awardName} onChange={e => setAwardName(e.target.value)} placeholder="e.g. 50 Days Survivor" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                       <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Emoji</label>
                       <input type="text" value={awardEmoji} onChange={e => setAwardEmoji(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900" />
                     </div>
                     <div>
                       <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Color Theme</label>
                       <select value={awardColor} onChange={e => {
                          const val = e.target.value;
                          setAwardColor(val);
                          if (val.includes('yellow')) { setAwardBg('bg-yellow-100 dark:bg-yellow-900/30'); setAwardBorder('border-yellow-200 dark:border-yellow-800'); }
                          else if (val.includes('emerald')) { setAwardBg('bg-emerald-100 dark:bg-emerald-900/30'); setAwardBorder('border-emerald-200 dark:border-emerald-800'); }
                          else if (val.includes('blue')) { setAwardBg('bg-blue-100 dark:bg-blue-900/30'); setAwardBorder('border-blue-200 dark:border-blue-800'); }
                          else if (val.includes('purple')) { setAwardBg('bg-purple-100 dark:bg-purple-900/30'); setAwardBorder('border-purple-200 dark:border-purple-800'); }
                       }} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                         <option value="text-yellow-600 dark:text-yellow-400">Gold / Yellow</option>
                         <option value="text-emerald-600 dark:text-emerald-400">Emerald / Green</option>
                         <option value="text-blue-600 dark:text-blue-400">Sapphire / Blue</option>
                         <option value="text-purple-600 dark:text-purple-400">Amethyst / Purple</option>
                       </select>
                     </div>
                  </div>
                  
                  <div className="pt-2 pb-2">
                    <p className="text-xs font-medium text-slate-500 mb-2">Preview:</p>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold shadow-sm ${awardBg} ${awardBorder} ${awardColor}`}>
                      <span>{awardEmoji}</span>
                      <span>{awardName || 'Badge Name'}</span>
                    </div>
                  </div>

                  <div className="pt-2 pb-2 border-t border-slate-100 dark:border-slate-700">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Award To</label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                        <input type="radio" checked={awardTarget === 'completed'} onChange={() => setAwardTarget('completed')} className="text-indigo-600 focus:ring-indigo-500" />
                        Completed Perfectly
                      </label>
                      <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                        <input type="radio" checked={awardTarget === 'all'} onChange={() => setAwardTarget('all')} className="text-indigo-600 focus:ring-indigo-500" />
                        All Participants
                      </label>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {getEligibleParticipants().length} participant(s) match this criteria.
                    </p>
                  </div>

                  <button 
                    onClick={handleAwardBadges}
                    disabled={awarding || !awardName.trim() || getEligibleParticipants().length === 0}
                    className="w-full flex items-center justify-center py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {awarding ? 'Awarding...' : `Award to ${getEligibleParticipants().length} Participant${getEligibleParticipants().length !== 1 ? 's' : ''}`}
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
