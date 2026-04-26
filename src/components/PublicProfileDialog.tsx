import React, { useState, useEffect } from 'react';
import { Trophy, CheckCircle, Crosshair, Flame, Calendar, X, Activity } from 'lucide-react';
import { UserProfile, MockScore } from '../types';
import { getHeatmapColor, getPlatformShort, parseLocalDate } from '../lib/utils';
import { getDocs, query, collection, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';

interface PublicProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile: (UserProfile & { leaderboardRank?: number }) | null;
  isCurrentUser: boolean;
  onEditProfile?: () => void;
  isAdmin?: boolean;
  onMuteUser?: (userId: string, isMuted: boolean) => void;
  onBanUser?: (userId: string, isBanned: boolean) => void;
}

export function PublicProfileDialog({ isOpen, onClose, profile, isCurrentUser, onEditProfile, isAdmin, onMuteUser, onBanUser }: PublicProfileDialogProps) {
  const [recentMocks, setRecentMocks] = useState<MockScore[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && profile?.userId) {
      const fetchMocks = async () => {
        setLoading(true);
        try {
          const q = query(collection(db, 'users', profile.userId, 'mocks'), orderBy('date', 'desc'), limit(5));
          const snap = await getDocs(q);
          setRecentMocks(snap.docs.map(d => d.data() as MockScore).filter(m => !(m as any).isDeleted));
        } catch (e) {
          console.error("Failed to fetch user mocks", e);
        }
        setLoading(false);
      };
      fetchMocks();
    }
  }, [isOpen, profile?.userId]);

  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-800 relative">
           <button onClick={onClose} className="absolute top-4 right-4 text-white hover:bg-white/20 p-1 rounded-full transition-colors">
              <X className="w-5 h-5" />
           </button>
           {isAdmin && !isCurrentUser && (
              <div className="absolute top-4 left-4 flex gap-2">
                 <button onClick={() => onMuteUser?.(profile.userId, !profile.isMuted)} className={`text-xs px-2 py-1 rounded bg-white/20 text-white hover:bg-white/30 transition-colors ${profile.isMuted ? 'text-red-300 dark:text-red-400' : ''}`}>
                   {profile.isMuted ? 'Unmute' : 'Mute'}
                 </button>
                 <button onClick={() => onBanUser?.(profile.userId, !profile.isBanned)} className={`text-xs px-2 py-1 rounded bg-white/20 text-white hover:bg-white/30 transition-colors ${profile.isBanned ? 'text-red-300 dark:text-red-400' : ''}`}>
                   {profile.isBanned ? 'Unban' : 'Ban'}
                 </button>
              </div>
           )}
        </div>
        
        <div className="px-6 pb-6 relative">
          <div className="flex justify-between items-end -mt-12 mb-4">
            <img 
              src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} 
              alt={profile.displayName} 
              className="w-24 h-24 rounded-2xl border-4 border-white dark:border-slate-900 shadow-md bg-white dark:bg-slate-800 object-cover"
            />
            {isCurrentUser && onEditProfile && (
               <button 
                 onClick={() => { onClose(); onEditProfile(); }}
                 className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mb-2 border border-slate-200 dark:border-slate-700"
               >
                 Edit Profile
               </button>
            )}
          </div>
          
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {profile.displayName}
              {profile.streak > 0 && <span className="flex items-center text-amber-500 text-sm"><Flame className="w-4 h-4" /></span>}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-slate-500 dark:text-slate-400 font-medium">
              <Crosshair className="w-4 h-4" />
              <span>Target: <span className="text-slate-700 dark:text-slate-300">{profile.targetedExam || 'Any'}</span></span>
            </div>
            {(profile.isMuted || profile.isBanned) && (
              <div className="mt-2 text-xs flex gap-2">
                  {profile.isMuted && <span className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50 px-2 py-0.5 rounded font-medium">Muted</span>}
                  {profile.isBanned && <span className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50 px-2 py-0.5 rounded font-medium">Banned</span>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col items-center justify-center text-center">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Rank</span>
              <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{profile.leaderboardRank ? `#${profile.leaderboardRank}` : '-'}</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col items-center justify-center text-center">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Mocks</span>
              <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{profile.totalTests || 0}</span>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl p-4 mb-4">
             <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Average Performance</div>
             <div className="flex items-end justify-between mb-4">
                <div>
                   <div className="text-3xl font-light text-slate-900 dark:text-slate-100 tracking-tight">{profile.avgPercentile || 0}<span className="text-lg text-slate-400 font-medium">%</span></div>
                   <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Overall Avg</div>
                </div>
                <div className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getHeatmapColor(profile.avgPercentile || 0)} border-current opacity-80`}>
                   Percentile
                </div>
             </div>
             
             {/* Sectional Averages block */}
             {profile.totalTests > 0 && (
               <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">QA</span>
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${getHeatmapColor(profile.avgQuantPercentile || 0)}`}>{profile.avgQuantPercentile || 0}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">RE</span>
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${getHeatmapColor(profile.avgReasoningPercentile || 0)}`}>{profile.avgReasoningPercentile || 0}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">EN</span>
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${getHeatmapColor(profile.avgEnglishPercentile || 0)}`}>{profile.avgEnglishPercentile || 0}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">GA</span>
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${getHeatmapColor(profile.avgGaPercentile || 0)}`}>{profile.avgGaPercentile || 0}%</span>
                  </div>
               </div>
             )}
          </div>

          {loading ? (
             <div className="py-4 text-center text-xs text-slate-400">Loading recent activity...</div>
          ) : recentMocks.length > 0 && (
             <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" /> Recent Activity
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                   {recentMocks.map(m => (
                      <div key={m.id} className="flex flex-col p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50 text-sm">
                         <div className="flex items-center justify-between mb-1">
                            <div className="font-medium text-slate-700 dark:text-slate-300 truncate mr-2 flex-1 relative flex items-center gap-2">
                               {m.mockName}
                               {parseLocalDate(m.date).toDateString() === new Date().toDateString() && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[9px] font-bold uppercase tracking-wider">Today</span>
                               )}
                            </div>
                            <div className="text-[10px] text-slate-400">{parseLocalDate(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                         </div>
                         <div className="flex justify-between items-end">
                            <span className="text-[10px] text-slate-500 bg-slate-200/50 dark:bg-slate-700 px-1.5 py-0.5 rounded">{m.examType}</span>
                            <div className="flex gap-2 items-center text-right">
                               <span className="font-mono text-slate-600 dark:text-slate-400 text-xs">Score: {m.score}</span>
                               <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${getHeatmapColor(m.percentile)}`}>{m.percentile}%P</span>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
