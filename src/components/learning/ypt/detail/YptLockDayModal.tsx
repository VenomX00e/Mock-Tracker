import React from 'react';
import { Lock, Unlock, X, CheckCircle2, RefreshCw } from 'lucide-react';
import { YptChallenge, YptDailyDaySnapshot, YptApiMember } from '../../../../types/yptTypes';
import {
  lockDaySnapshot,
  deleteDailySnapshot,
  recalculateTeamPointsFromSubmissions,
} from '../../../../services/yptService';
import { getChallengeStartDateYmd, getChallengeEndDateYmd } from '../../../../utils/yptUtils';

interface YptLockDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: YptChallenge;
  dailySnapshots: YptDailyDaySnapshot[];
  liveRosterMembers: YptApiMember[];
  lockTargetDateYmd: string;
  setLockTargetDateYmd: (ymd: string) => void;
  isLockingDay: boolean;
  setIsLockingDay: (val: boolean) => void;
  isSyncingDayLog: boolean;
  onSyncYptDayLog: (ymd: string) => void;
  formatShortDate: (ymd: string) => string;
  fetchLogs: () => Promise<void>;
  onRefresh: () => void;
}

export function YptLockDayModal({
  isOpen,
  onClose,
  challenge,
  dailySnapshots,
  liveRosterMembers,
  lockTargetDateYmd,
  setLockTargetDateYmd,
  isLockingDay,
  setIsLockingDay,
  isSyncingDayLog,
  onSyncYptDayLog,
  formatShortDate,
  fetchLogs,
  onRefresh,
}: YptLockDayModalProps) {
  if (!isOpen) return null;

  const targetSnapshot = dailySnapshots.find((s) => s.targetDateYmd === lockTargetDateYmd);
  const isAlreadyLocked = Boolean(targetSnapshot);
  const minAllowed = getChallengeStartDateYmd(challenge);
  const maxAllowed = getChallengeEndDateYmd(challenge);

  const handleExecuteLock = async () => {
    setIsLockingDay(true);
    try {
      await lockDaySnapshot(challenge, lockTargetDateYmd, liveRosterMembers);
      await fetchLogs();
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to lock day snapshot:', err);
    } finally {
      setIsLockingDay(false);
    }
  };

  const handleExecuteUnlock = async () => {
    if (
      !confirm(
        `Are you sure you want to unlock ${formatShortDate(lockTargetDateYmd)}? It will revert to live/submission mode until closed again.`
      )
    ) {
      return;
    }
    setIsLockingDay(true);
    try {
      await deleteDailySnapshot(challenge.id, lockTargetDateYmd);
      await recalculateTeamPointsFromSubmissions(challenge.id);
      await fetchLogs();
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to delete snapshot:', err);
    } finally {
      setIsLockingDay(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                {isAlreadyLocked ? 'Manage Day Snapshot' : 'Lock Day Snapshot'}
              </h3>
              <p className="text-[11px] text-slate-500">{challenge.title}</p>
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

        <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Select Target Date
            </label>
            <input
              type="date"
              min={minAllowed}
              max={maxAllowed}
              value={lockTargetDateYmd}
              onChange={(e) => setLockTargetDateYmd(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono font-medium"
            />
          </div>

          {isAlreadyLocked ? (
            <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl space-y-1.5">
              <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                This date is currently Locked & Finalized
              </p>
              <p className="text-[11px] text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
                Closed: {new Date(targetSnapshot!.closedAt).toLocaleString()} (
                {targetSnapshot!.isAutoClosed ? 'Auto-closed' : 'Manual override'})
                <br />
                Total Points Awarded: <strong>{targetSnapshot!.totalPointsAwarded} XP</strong> across{' '}
                {targetSnapshot!.memberRecords?.length || 0} members.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
              <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-500" />
                Freeze Study Hours & XP
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Freezes current study stats and rules into a permanent daily snapshot. Ideal for locking scores at the
                end of the day or late evening.
              </p>
            </div>
          )}

          {/* Quick Sync YPT Day Log before locking */}
          <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/50 rounded-2xl flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-sky-900 dark:text-sky-200">
                Pull Real Study Minutes from YPT
              </p>
              <p className="text-[10px] text-sky-700/80 dark:text-sky-300/80">
                Calls GET /logs/day?date={lockTargetDateYmd}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSyncYptDayLog(lockTargetDateYmd)}
              disabled={isSyncingDayLog}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-white dark:bg-slate-900 hover:bg-sky-100 dark:hover:bg-sky-950 border border-sky-200 dark:border-sky-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-2xs"
            >
              <RefreshCw className={`w-3 h-3 text-sky-600 ${isSyncingDayLog ? 'animate-spin' : ''}`} />
              <span>{isSyncingDayLog ? 'Syncing...' : 'Sync from YPT'}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          {isAlreadyLocked ? (
            <button
              type="button"
              onClick={handleExecuteUnlock}
              disabled={isLockingDay}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              Unlock Date
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLockingDay}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteLock}
              disabled={isLockingDay}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {isLockingDay ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Locking...
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  {isAlreadyLocked ? 'Re-Lock Snapshot' : 'Lock Day Snapshot'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
