import React from 'react';
import { Trophy, CheckCircle, Crosshair, Flame, Calendar, X } from 'lucide-react';
import { UserProfile, MockScore } from '../types';
import { getHeatmapColor } from '../lib/utils';

interface PublicProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile: (UserProfile & { leaderboardRank?: number, todaysMocks?: MockScore[] }) | null;
  isCurrentUser: boolean;
  onEditProfile?: () => void;
  isAdmin?: boolean;
  onMuteUser?: (userId: string, isMuted: boolean) => void;
  onBanUser?: (userId: string, isBanned: boolean) => void;
}

export function PublicProfileDialog({ isOpen, onClose, profile, isCurrentUser, onEditProfile, isAdmin, onMuteUser, onBanUser }: PublicProfileDialogProps) {
  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 relative">
           <button onClick={onClose} className="absolute top-4 right-4 text-white hover:bg-white/20 p-1 rounded-full transition-colors">
              <X className="w-5 h-5" />
           </button>
           {isAdmin && !isCurrentUser && (
              <div className="absolute top-4 left-4 flex gap-2">
                 <button onClick={() => onMuteUser?.(profile.userId, !profile.isMuted)} className={`text-xs px-2 py-1 rounded bg-white/20 text-white hover:bg-white/30 transition-colors ${profile.isMuted ? 'text-red-300' : ''}`}>
                   {profile.isMuted ? 'Unmute' : 'Mute'}
                 </button>
                 <button onClick={() => onBanUser?.(profile.userId, !profile.isBanned)} className={`text-xs px-2 py-1 rounded bg-white/20 text-white hover:bg-white/30 transition-colors ${profile.isBanned ? 'text-red-300' : ''}`}>
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
              className="w-24 h-24 rounded-2xl border-4 border-white shadow-md bg-white object-cover"
            />
            {isCurrentUser && onEditProfile && (
               <button 
                 onClick={() => { onClose(); onEditProfile(); }}
                 className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors mb-2"
               >
                 Edit Profile
               </button>
            )}
          </div>
          
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              {profile.displayName}
              {profile.streak > 0 && <span className="flex items-center text-amber-500 text-sm"><Flame className="w-4 h-4" /></span>}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-slate-500 font-medium">
              <Crosshair className="w-4 h-4" />
              <span>Target: <span className="text-slate-700">{profile.targetedExam || 'Any'}</span></span>
            </div>
            {(profile.isMuted || profile.isBanned) && (
              <div className="mt-2 text-xs flex gap-2">
                  {profile.isMuted && <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded font-medium">Muted</span>}
                  {profile.isBanned && <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded font-medium">Banned</span>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Rank</span>
              <span className="text-2xl font-bold text-indigo-600">{profile.leaderboardRank ? `#${profile.leaderboardRank}` : '-'}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Mocks</span>
              <span className="text-2xl font-bold text-slate-800">{profile.totalTests || 0}</span>
            </div>
          </div>
          
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6">
             <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Average Performance</div>
             <div className="flex items-end justify-between">
                <div>
                   <div className="text-3xl font-light text-slate-900 tracking-tight">{profile.avgPercentile || 0}<span className="text-lg text-slate-400 font-medium">%</span></div>
                   <div className="text-xs text-slate-500 mt-1">Overall Avg</div>
                </div>
                <div className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getHeatmapColor(profile.avgPercentile || 0)}`}>
                   Percentile
                </div>
             </div>
          </div>

          {profile.todaysMocks && profile.todaysMocks.length > 0 && (
             <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Today's Mocks
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                   {profile.todaysMocks.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                         <div className="font-medium text-slate-700 truncate mr-2 flex-1">{m.mockName}</div>
                         <div className="flex gap-3 text-right">
                            <span className="font-mono text-slate-600">{m.score}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${getHeatmapColor(m.percentile)}`}>{m.percentile}%</span>
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
