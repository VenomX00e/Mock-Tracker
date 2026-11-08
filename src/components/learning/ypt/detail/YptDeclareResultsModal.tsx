import React from 'react';
import { Trophy, X, Crown, AlertTriangle, RefreshCw, Award } from 'lucide-react';
import { YptChallenge, YptDailyDaySnapshot } from '../../../../types/yptTypes';
import {
  completeYptChallenge,
  recalculateTeamPointsFromSnapshots,
} from '../../../../services/yptService';
import {
  areYptHandlesMatching,
  getChallengeEndDateYmd,
  formatStudyDuration,
} from '../../../../utils/yptUtils';

interface YptDeclareResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: YptChallenge;
  dailySnapshots: YptDailyDaySnapshot[];
  isSoloMode: boolean;
  completedByLabel: string;
  isSubmittingResults: boolean;
  setIsSubmittingResults: (val: boolean) => void;
  formatShortDate: (ymd: string) => string;
  onRefresh: () => void;
}

export function YptDeclareResultsModal({
  isOpen,
  onClose,
  challenge,
  dailySnapshots,
  isSoloMode,
  completedByLabel,
  isSubmittingResults,
  setIsSubmittingResults,
  formatShortDate,
  onRefresh,
}: YptDeclareResultsModalProps) {
  if (!isOpen) return null;

  // Calculate summary stats for the modal preview directly from dailySnapshots
  const teamMap = new Map<string, { name: string; color: string; points: number; hours: number }>();
  const memberHoursMap = new Map<string, number>();
  const memberPointsMap = new Map<string, number>();

  (challenge.teams || []).forEach((t) => {
    teamMap.set(t.id, { name: t.name, color: t.color || '#6366f1', points: 0, hours: 0 });
  });

  let grandTotalHours = 0;

  dailySnapshots.forEach((snap) => {
    const entries: Array<{ handle: string; hours: number; points: number; userId?: string }> = [];

    if (snap.memberSnapshots && Object.keys(snap.memberSnapshots).length > 0) {
      Object.values(snap.memberSnapshots).forEach((ms) => {
        entries.push({
          handle: ms.handle,
          hours: ms.hoursStudied || 0,
          points: ms.netPoints || 0,
          userId: ms.rawYptUd ? String(ms.rawYptUd) : undefined,
        });
      });
    } else if (Array.isArray(snap.memberRecords)) {
      snap.memberRecords.forEach((mr) => {
        entries.push({
          handle: mr.yptHandle,
          hours: mr.hoursStudied || 0,
          points: mr.netPoints || 0,
          userId: mr.userId,
        });
      });
    }

    entries.forEach(({ handle, hours, points, userId }) => {
      const clean = (handle || '').replace(/^@/, '').trim().toLowerCase();
      grandTotalHours += hours;

      memberHoursMap.set(clean, (memberHoursMap.get(clean) || 0) + hours);
      memberPointsMap.set(clean, (memberPointsMap.get(clean) || 0) + points);

      const targetTeam = (challenge.teams || []).find((t) =>
        (t.memberUids || []).some((m) => areYptHandlesMatching(m, handle, userId))
      );

      if (targetTeam) {
        const entry = teamMap.get(targetTeam.id);
        if (entry) {
          entry.points += points;
          entry.hours += hours;
        }
      }
    });
  });

  // Champion Team (for Team mode)
  const sortedTeamsList = Array.from(teamMap.entries()).map(([id, data]) => ({ id, ...data }));
  sortedTeamsList.sort((a, b) => b.points - a.points || b.hours - a.hours);
  const championTeam = sortedTeamsList.length > 0 ? sortedTeamsList[0] : null;

  // Solo Champion (for Individual mode)
  const sortedSoloList = Array.from(memberPointsMap.entries()).map(([handle, points]) => ({
    handle,
    points,
    hours: memberHoursMap.get(handle) || 0,
  }));
  sortedSoloList.sort((a, b) => b.points - a.points || b.hours - a.hours);
  const soloChampion = sortedSoloList.length > 0 ? sortedSoloList[0] : null;

  // Overall MVP
  const sortedMembersList = Array.from(memberHoursMap.entries()).map(([handle, hours]) => ({ handle, hours }));
  sortedMembersList.sort((a, b) => b.hours - a.hours);
  const overallMvp = sortedMembersList.length > 0 && sortedMembersList[0].hours > 0 ? sortedMembersList[0] : null;

  const handleConfirmComplete = async () => {
    try {
      setIsSubmittingResults(true);
      const matchingSoloRef =
        isSoloMode && soloChampion
          ? (challenge.participants || []).find((p) => areYptHandlesMatching(p.yptHandle, soloChampion.handle))
          : undefined;

      await completeYptChallenge(challenge.id, {
        completedBy: completedByLabel,
        winningTeamId: isSoloMode ? '' : championTeam?.id || '',
        winningParticipantUd: matchingSoloRef?.yptUd,
        winningParticipantHandle: isSoloMode ? soloChampion?.handle || '' : '',
        finalMvpHandle: isSoloMode ? soloChampion?.handle || '' : overallMvp?.handle || '',
      });
      await recalculateTeamPointsFromSnapshots(challenge.id);
      onClose();
      onRefresh();
    } catch (err) {
      console.error('Failed to complete challenge:', err);
    } finally {
      setIsSubmittingResults(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Declare & Lock Final Results
              </h3>
              <p className="text-[11px] text-slate-500">
                {challenge.title} • {isSoloMode ? 'Solo Royale' : 'Team Battle'} • End Date:{' '}
                {formatShortDate(getChallengeEndDateYmd(challenge))}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl space-y-2">
            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" /> Challenge Final Summary
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
              <div className="p-2.5 bg-white dark:bg-slate-950 rounded-xl border border-indigo-100 dark:border-indigo-900/60">
                <span className="text-[10px] text-slate-400 font-medium block">
                  {isSoloMode ? '👑 Solo Champion (1st Place)' : '🏆 Champion Team'}
                </span>
                <span className="font-extrabold text-slate-900 dark:text-white text-xs flex items-center gap-1.5 mt-0.5">
                  {isSoloMode ? (
                    soloChampion ? (
                      <span className="font-mono text-amber-500">
                        @{soloChampion.handle.replace(/^@/, '')} ({soloChampion.points} XP)
                      </span>
                    ) : (
                      'No participant data'
                    )
                  ) : championTeam ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: championTeam.color }} />
                      <span>
                        {championTeam.name} ({championTeam.points} XP)
                      </span>
                    </>
                  ) : (
                    'No team data'
                  )}
                </span>
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-950 rounded-xl border border-indigo-100 dark:border-indigo-900/60">
                <span className="text-[10px] text-slate-400 font-medium block">
                  {isSoloMode ? '⏱️ Top Study Time' : '👑 Challenge MVP'}
                </span>
                <span className="font-extrabold text-slate-900 dark:text-white text-xs block mt-0.5 font-mono">
                  {overallMvp
                    ? `@${overallMvp.handle.replace(/^@/, '')} (${formatStudyDuration(overallMvp.hours)})`
                    : 'No MVP'}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-white dark:bg-slate-950 rounded-xl border border-indigo-100 dark:border-indigo-900/60 text-xs">
              <span className="text-[10px] text-slate-400 font-medium block">⏱️ Grand Total Study Hours Logged</span>
              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                {formatStudyDuration(grandTotalHours)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl text-xs space-y-1.5 text-amber-900 dark:text-amber-200">
            <p className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              What happens when you confirm?
            </p>
            <ul className="list-disc list-inside text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
              <li>
                The challenge status will be set to <strong>Completed</strong>.
              </li>
              <li>
                It will move from <strong>Active Challenges</strong> to the <strong>Completed Challenges</strong> tab
                in the YPT Hub.
              </li>
              <li>Participants will be able to review final rankings and stats in read-only mode.</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmittingResults}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmComplete}
            disabled={isSubmittingResults}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {isSubmittingResults ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Locking Results...
              </>
            ) : (
              <>
                <Award className="w-4 h-4" />
                Confirm & Lock Results
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
