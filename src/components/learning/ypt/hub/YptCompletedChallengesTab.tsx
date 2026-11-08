import React from 'react';
import { Trophy, Users, User, Award, ChevronRight, Calendar, Trash2, Crown, CheckCircle2, RotateCcw } from 'lucide-react';
import { YptChallenge } from '../../../../types/yptTypes';
import { formatDisplayYmd } from '../../../../utils/yptUtils';

interface YptCompletedChallengesTabProps {
  completedChallenges: YptChallenge[];
  canManageYptChallenges: boolean;
  onSelectChallenge: (challenge: YptChallenge) => void;
  onReopenChallenge: (e: React.MouseEvent, challenge: YptChallenge) => void;
  onDeleteChallenge: (e: React.MouseEvent, challenge: YptChallenge) => void;
}

export function YptCompletedChallengesTab({
  completedChallenges,
  canManageYptChallenges,
  onSelectChallenge,
  onReopenChallenge,
  onDeleteChallenge,
}: YptCompletedChallengesTabProps) {
  if (completedChallenges.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-2xl text-center space-y-3">
        <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500/60 mx-auto" />
        <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">No Completed Challenges Yet</h3>
        <p className="text-[11px] sm:text-xs text-slate-500 max-w-sm mx-auto">
          When an active challenge is concluded and results are published by an admin, it will appear here with final standings and awards.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
      {completedChallenges.map((c) => {
        const isSolo = c.mode === 'individual';
        const teamsList = c.teams || [];
        const winningTeam = !isSolo
          ? teamsList.find((t) => t.id === c.winningTeamId) ||
            (teamsList.length > 0 ? teamsList.slice().sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))[0] : null)
          : null;
        const mvpHandle = c.finalMvpHandle ? `@${c.finalMvpHandle.replace(/^@/, '')}` : null;
        const soloWinnerHandle = c.winningParticipantHandle ? `@${c.winningParticipantHandle.replace(/^@/, '')}` : mvpHandle;

        return (
          <div
            key={c.id}
            onClick={() => onSelectChallenge(c)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 p-3.5 sm:p-5 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1">
                    🏁 COMPLETED
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
                  <span className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {c.completedAt ? formatDisplayYmd(c.completedAt) : formatDisplayYmd(c.endDate)}
                  </span>
                  {canManageYptChallenges && (
                    <>
                      <button
                        onClick={(e) => onReopenChallenge(e, c)}
                        className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                        title="Re-open Challenge back to Active"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
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

              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {c.title}
              </h3>
              {c.description && (
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {c.description}
                </p>
              )}

              {/* Winner Summary Badges */}
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                {isSolo && soloWinnerHandle && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] font-extrabold">
                    <div className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-black text-[10px] flex items-center justify-center shadow-xs shrink-0">
                      {soloWinnerHandle.replace(/^@/, '').slice(0, 1).toUpperCase()}
                    </div>
                    <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-mono">Champion: {soloWinnerHandle.replace(/^@/, '')}</span>
                  </div>
                )}
                {isSolo && mvpHandle && mvpHandle !== soloWinnerHandle && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold font-mono">
                    <Crown className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>MVP: {mvpHandle.replace(/^@/, '')}</span>
                  </div>
                )}
                {!isSolo && winningTeam && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-extrabold">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Winner: {winningTeam.name} ({winningTeam.totalPoints} XP)</span>
                  </div>
                )}
                {!isSolo && mvpHandle && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold font-mono">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>MVP: {mvpHandle.replace(/^@/, '')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] sm:text-xs">
              <div className="flex items-center gap-2.5 sm:gap-3 text-slate-600 dark:text-slate-400 font-medium">
                {isSolo ? (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-purple-500 shrink-0" /> {c.participants?.length || 0} Participants
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> {teamsList.length} Teams
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Final Results Locked
                </span>
              </div>

              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                View Final Standings <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface YptTeamRankingsTabProps {
  allVisibleChallenges: YptChallenge[];
}

export function YptTeamRankingsTab({ allVisibleChallenges }: YptTeamRankingsTabProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-400" /> Overall Challenge Standings
      </h3>

      <div className="space-y-3">
        {allVisibleChallenges.flatMap((c) => c.teams || []).length === 0 ? (
          <div className="text-xs text-slate-500 py-4 text-center">No team records found.</div>
        ) : (
          allVisibleChallenges
            .flatMap((c) => (c.teams || []).map((t) => ({ ...t, challengeTitle: c.title })))
            .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
            .map((team, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs flex items-center justify-center shrink-0">
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{team.name}</p>
                    <p className="text-[10px] text-slate-500">{team.challengeTitle}</p>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                  {team.totalPoints} XP
                </span>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
