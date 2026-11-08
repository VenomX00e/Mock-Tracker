import React from 'react';
import { Trophy, Users, User, Award, ChevronRight, Calendar, Settings, Trash2 } from 'lucide-react';
import { YptChallenge } from '../../../../types/yptTypes';
import { formatDisplayYmd } from '../../../../utils/yptUtils';

interface YptActiveChallengesTabProps {
  activeChallenges: YptChallenge[];
  canManageYptChallenges: boolean;
  onCreateClick: () => void;
  onSelectChallenge: (challenge: YptChallenge) => void;
  onEditChallenge: (e: React.MouseEvent, challenge: YptChallenge) => void;
  onDeleteChallenge: (e: React.MouseEvent, challenge: YptChallenge) => void;
}

export function YptActiveChallengesTab({
  activeChallenges,
  canManageYptChallenges,
  onCreateClick,
  onSelectChallenge,
  onEditChallenge,
  onDeleteChallenge,
}: YptActiveChallengesTabProps) {
  if (activeChallenges.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-2xl text-center space-y-3">
        <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400 mx-auto" />
        <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">No Active YPT Challenges</h3>
        <p className="text-[11px] sm:text-xs text-slate-500 max-w-sm mx-auto">
          Create your first team study challenge to start tracking YPT group study hours automatically!
        </p>
        {canManageYptChallenges && (
          <button
            onClick={onCreateClick}
            className="px-3.5 sm:px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all"
          >
            Create First Challenge
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
      {activeChallenges.map((c) => {
        const isSolo = c.mode === 'individual';

        return (
          <div
            key={c.id}
            onClick={() => onSelectChallenge(c)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 p-3.5 sm:p-5 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                    {c.status}
                  </span>
                  <span
                    className={`px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold border uppercase tracking-wider flex items-center gap-1 ${
                      isSolo
                        ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25'
                        : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                    }`}
                  >
                    {isSolo ? <User className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                    <span>{isSolo ? 'Individual' : 'Team Battle'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {formatDisplayYmd(c.startDate)}
                  </span>
                  {/* Action buttons on card */}
                  {canManageYptChallenges && (
                    <>
                      <button
                        onClick={(e) => onEditChallenge(e, c)}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Edit Settings"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => onDeleteChallenge(e, c)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Move to Recycle Bin"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {c.title}
              </h3>
              {c.description && (
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {c.description}
                </p>
              )}
            </div>

            <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] sm:text-xs">
              <div className="flex items-center gap-2.5 sm:gap-3 text-slate-600 dark:text-slate-400 font-medium">
                {isSolo ? (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-purple-500 shrink-0" /> {c.participants?.length || 0} Participants
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> {c.teams?.length || 0} Teams
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" /> {c.rules?.pointsPerInterval ?? c.rules?.pointsPerStudyHour ?? 1} XP/hr
                </span>
              </div>

              <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                View <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
