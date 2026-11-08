import React from 'react';
import {
  Trophy,
  Users,
  User,
  UserCheck,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Calendar,
  Settings,
  Trash2,
  Crown,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  LayoutGrid,
  Columns,
  Zap,
  Lock,
  AlertCircle,
  TrendingUp,
  Pause,
  Play,
} from 'lucide-react';
import { YptChallenge, YptDailyDaySnapshot } from '../../../../types/yptTypes';
import { reopenYptChallenge } from '../../../../services/yptService';
import {
  getLocalYmd,
  getYptDayYmd,
  getChallengeStartDateYmd,
  getChallengeEndDateYmd,
  formatDisplayYmd,
} from '../../../../utils/yptUtils';

function formatSyncTimeAgo(val: any): string {
  if (!val) return '';
  let millis = 0;
  if (typeof val === 'number') {
    millis = val;
  } else if (typeof val === 'string') {
    millis = new Date(val).getTime();
  } else if (val && typeof val.toDate === 'function') {
    millis = val.toDate().getTime();
  } else if (val && typeof val.seconds === 'number') {
    millis = val.seconds * 1000;
  }
  if (!millis || isNaN(millis)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - millis) / 1000));
  if (diffSec < 45) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

interface YptChallengeHeaderProps {
  challenge: YptChallenge;
  isSoloMode: boolean;
  canManageYptChallenges: boolean;
  isResettingToday: boolean;
  isDeleting: boolean;
  onBack: () => void;
  onResetTodayData: () => void;
  onOpenEditModal: () => void;
  onSoftDelete: () => void;
  onRefresh: () => void;
}

export function YptChallengeHeader({
  challenge,
  isSoloMode,
  canManageYptChallenges,
  isResettingToday,
  isDeleting,
  onBack,
  onResetTodayData,
  onOpenEditModal,
  onSoftDelete,
  onRefresh,
}: YptChallengeHeaderProps) {
  return (
    <>
      {/* Back Button & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Back to Challenges
        </button>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {canManageYptChallenges && (
            <>
              <button
                onClick={onResetTodayData}
                disabled={isResettingToday}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                title="Purge leaked 12:01 hours and reset Today's leaderboard back to 0:00"
              >
                <RefreshCw
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0 ${
                    isResettingToday ? 'animate-spin' : ''
                  }`}
                />
                <span>{isResettingToday ? 'Resetting...' : "Reset Today's Data"}</span>
              </button>

              <button
                onClick={onOpenEditModal}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                title={isSoloMode ? 'Manage Participants & Settings' : 'Edit Challenge Settings'}
              >
                {isSoloMode ? (
                  <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-500 shrink-0" />
                ) : (
                  <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                )}
                <span>{isSoloMode ? 'Manage Participants' : 'Settings'}</span>
              </button>

              <button
                onClick={onSoftDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                title="Move to Recycle Bin"
              >
                <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500 shrink-0" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Challenge Hero Header */}
      <div
        className={`relative overflow-hidden ${
          isSoloMode
            ? 'bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 border-purple-500/30'
            : 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-indigo-500/30'
        } p-4 sm:p-7 rounded-3xl border text-white shadow-xl space-y-3 sm:space-y-5`}
      >
        {/* Subtle decorative glow */}
        <div
          className={`absolute -top-24 -right-24 w-64 h-64 ${
            isSoloMode ? 'bg-purple-500/15' : 'bg-indigo-500/15'
          } rounded-full blur-3xl pointer-events-none`}
        />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span
                className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-extrabold uppercase tracking-wider border shadow-xs ${
                  challenge.status === 'active'
                    ? isSoloMode
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                }`}
              >
                {isSoloMode ? (
                  <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                ) : (
                  <span
                    className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                      challenge.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400'
                    }`}
                  />
                )}
                {challenge.status === 'active' ? 'Active' : challenge.status}{' '}
                {isSoloMode ? 'Individual Challenge' : 'Team Challenge'}
              </span>
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium text-slate-300 bg-white/10 backdrop-blur-md border border-white/10">
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-300 shrink-0" />
                {formatDisplayYmd(challenge.startDate)} — {formatDisplayYmd(challenge.endDate)}
              </span>
              {(challenge.lastCronSyncAt || challenge.lastSyncedAt) && (
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium text-emerald-300 bg-emerald-500/15 backdrop-blur-md border border-emerald-500/30">
                  <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
                  Auto-synced {formatSyncTimeAgo(challenge.lastCronSyncAt || challenge.lastSyncedAt)}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight drop-shadow-xs">
              {challenge.title}
            </h2>

            {challenge.description && (
              <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed max-w-2xl">
                {challenge.description}
              </p>
            )}
          </div>
        </div>

        {/* Rule Summary Chips */}
        <div className="relative z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 pt-3 border-t border-white/10 text-[11px] sm:text-xs">
          <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-slate-200 font-medium">
            <span className="text-indigo-300 font-bold">Study Rate:</span>
            <span className="font-semibold text-white">
              +{challenge.rules.pointsPerInterval ?? challenge.rules.pointsPerStudyHour} XP
            </span>
            <span className="text-slate-400">
              / {challenge.rules.studyIntervalValue ?? 1} {challenge.rules.studyIntervalUnit ?? 'hr'}
            </span>
          </div>

          <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-slate-200 font-medium">
            <span className="text-rose-300 font-bold">Penalty:</span>
            <span className="font-semibold text-rose-200">-{challenge.rules.penaltyPoints} XP</span>
            <span className="text-slate-400">
              (&lt;
              {challenge.rules.penaltyThresholdValue ?? challenge.rules.noStudyPenaltyThresholdHours ?? 3}{' '}
              {challenge.rules.penaltyThresholdUnit ?? 'hrs'})
            </span>
          </div>

          {typeof challenge.rules.maxContinuousHoursThreshold === 'number' &&
            challenge.rules.maxContinuousHoursThreshold > 0 && (
              <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-rose-500/15 backdrop-blur-md border border-rose-500/25 text-rose-200 font-medium">
                <span>🚨</span>
                <span className="font-bold text-rose-300">Session Limit:</span>
                <span className="font-semibold text-white">
                  &gt;{challenge.rules.maxContinuousHoursThreshold} hrs{' '}
                  {challenge.rules.maxContinuousPenaltyType === 'fixed'
                    ? `(-${challenge.rules.maxContinuousFixedPenalty ?? 10} XP)`
                    : `(${challenge.rules.maxContinuousPenaltyMultiplier ?? 2}x ${
                        challenge.rules.maxContinuousPenaltyMode === 'whole' ? 'entire' : 'excess'
                      })`}
                </span>
              </div>
            )}

          {typeof challenge.rules.morningSnapBonus === 'number' && (
            <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-amber-500/15 backdrop-blur-md border border-amber-500/25 text-amber-200 font-medium">
              <span>☀️</span>
              <span className="font-bold text-amber-300">Morning Snap:</span>
              <span className="font-semibold text-white">+{challenge.rules.morningSnapBonus} XP</span>
            </div>
          )}

          {Array.isArray(challenge.rules.customRules) &&
            challenge.rules.customRules.map((cr) => (
              <div
                key={cr.id}
                className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl backdrop-blur-md border font-medium ${
                  !isSoloMode && cr.scope === 'team_all'
                    ? 'bg-purple-500/20 border-purple-500/35 text-purple-200'
                    : 'bg-white/10 border-white/10 text-slate-200'
                }`}
              >
                <span>{cr.emoji || (cr.type === 'bonus' ? '☀️' : '📱')}</span>
                <span className="font-bold text-white">{cr.name}:</span>
                <span className={`font-semibold ${cr.type === 'bonus' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {cr.type === 'bonus' ? '+' : '-'}
                  {cr.points} XP
                </span>
                {!isSoloMode && cr.scope === 'team_all' && (
                  <span className="ml-0.5 text-[8px] sm:text-[9px] font-extrabold px-1 sm:px-1.5 py-0.5 rounded-md bg-purple-400/25 text-purple-100 border border-purple-300/30 uppercase tracking-wide">
                    👥 Team Rule (100%)
                  </span>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Hall of Fame / Tournament Concluded Showcase */}
      {challenge.status === 'completed' && (
        <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-indigo-500/15 border-2 border-amber-500/30 dark:border-amber-400/30 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-md shrink-0">
                <Trophy className="w-6 h-6 text-amber-950" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                    🏆 Tournament Concluded & Locked
                  </span>
                  {challenge.completedAt && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {formatDisplayYmd(challenge.completedAt)}
                    </span>
                  )}
                </div>

                {isSoloMode ? (
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Champion:</span>
                      <span className="text-amber-600 dark:text-amber-400 font-mono">
                        {challenge.winningParticipantHandle
                          ? challenge.winningParticipantHandle.replace(/^@/, '')
                          : challenge.finalMvpHandle
                          ? challenge.finalMvpHandle.replace(/^@/, '')
                          : 'Individual Winner'}
                      </span>
                    </h2>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Winning Team:</span>
                      <span className="text-amber-600 dark:text-amber-400">
                        {(challenge.teams || []).find((t) => t.id === challenge.winningTeamId)?.name || 'Champion Team'}
                      </span>
                    </h2>
                    {challenge.finalMvpHandle && (
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-xs font-bold font-mono flex items-center gap-1">
                        <Crown className="w-3 h-3 text-amber-400" />
                        MVP: {challenge.finalMvpHandle.replace(/^@/, '')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {canManageYptChallenges && (
              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to re-open this challenge back to active status?')) {
                      try {
                        await reopenYptChallenge(challenge.id);
                        onRefresh();
                      } catch (e) {
                        console.error('Failed to reopen challenge:', e);
                      }
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                  <span>Re-open Challenge</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

interface YptArenaControlsHeaderProps {
  challenge: YptChallenge;
  isSoloMode: boolean;
  canManageYptChallenges: boolean;
  isLiveRosterLoading: boolean;
  onFetchLiveRoster: () => void;
  showTrendsChart: boolean;
  setShowTrendsChart: (val: boolean) => void;
  soloViewMode: 'cards' | 'table';
  setSoloViewMode: (mode: 'cards' | 'table') => void;
  teamViewMode: 'grid' | 'swipe';
  setTeamViewMode: (mode: 'grid' | 'swipe') => void;
  dateFilter: 'date' | 'allTime';
  setDateFilter: (filter: 'date' | 'allTime') => void;
  selectedFilterDateYmd: string;
  setSelectedFilterDateYmd: (ymd: string) => void;
  dailySnapshots: YptDailyDaySnapshot[];
  onOpenLockDayModal: (targetDateYmd: string) => void;
  formatShortDate: (ymd: string) => string;
  dayLogFeedback: {
    type: 'success' | 'error';
    message: string;
    subjects?: any[];
  } | null;
  setDayLogFeedback: (
    feedback: {
      type: 'success' | 'error';
      message: string;
      subjects?: any[];
    } | null
  ) => void;
}

export function YptArenaControlsHeader({
  challenge,
  isSoloMode,
  canManageYptChallenges,
  isLiveRosterLoading,
  onFetchLiveRoster,
  showTrendsChart,
  setShowTrendsChart,
  soloViewMode,
  setSoloViewMode,
  teamViewMode,
  setTeamViewMode,
  dateFilter,
  setDateFilter,
  selectedFilterDateYmd,
  setSelectedFilterDateYmd,
  dailySnapshots,
  onOpenLockDayModal,
  formatShortDate,
  dayLogFeedback,
  setDayLogFeedback,
}: YptArenaControlsHeaderProps) {
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                {isSoloMode ? (
                  <User className="w-4 h-4 text-purple-500 shrink-0" />
                ) : (
                  <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                )}
                {isSoloMode ? 'Individual Standings Arena' : 'Team Score Comparison Arena'}
              </h3>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 border transition-colors bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLiveRosterLoading ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500 animate-pulse'
                    }`}
                  />
                  <span>Sync</span>
                  <button
                    type="button"
                    onClick={onFetchLiveRoster}
                    disabled={isLiveRosterLoading}
                    className="ml-1 p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                    title="Manual one-off refresh from YPT API"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLiveRosterLoading ? 'animate-spin text-indigo-500' : ''}`} />
                  </button>
                </span>
              </div>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              {isSoloMode ? 'Live performance ranking & participant standings' : 'Live performance ranking & team standings'}
            </p>
          </div>

          {/* View Switcher & Trends Toggle */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowTrendsChart(!showTrendsChart)}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                showTrendsChart
                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title="Toggle Performance Trends Chart"
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0 text-purple-500" />
              <span>{showTrendsChart ? 'Hide Trends' : 'Trends'}</span>
            </button>

            <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold shrink-0">
              {isSoloMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSoloViewMode('cards')}
                    className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      soloViewMode === 'cards'
                        ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs border border-purple-100 dark:border-purple-950/60'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title="Cards View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                    <span>Cards</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSoloViewMode('table')}
                    className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      soloViewMode === 'table'
                        ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs border border-purple-100 dark:border-purple-950/60'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title="Table View"
                  >
                    <Columns className="w-3.5 h-3.5 shrink-0" />
                    <span>Table</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setTeamViewMode('grid')}
                    className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      teamViewMode === 'grid'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-100 dark:border-indigo-950/60'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title="Grid View Layout"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                    <span>Grid</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTeamViewMode('swipe')}
                    className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      teamViewMode === 'swipe'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-100 dark:border-indigo-950/60'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title="Swipe Horizontal View"
                  >
                    <Columns className="w-3.5 h-3.5 shrink-0" />
                    <span>Swipe</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Date Toggle Control: Date Navigator (Today -> Yesterday -> Date) / All-Time */}
        {(() => {
          const minFilterDateYmd = getChallengeStartDateYmd(challenge);
          const maxFilterDateYmd = getChallengeEndDateYmd(challenge);
          const todayStr = getYptDayYmd();

          const isPrevDateDisabled = selectedFilterDateYmd <= minFilterDateYmd;
          const isNextDateDisabled = selectedFilterDateYmd >= maxFilterDateYmd;

          const getDayOffsetFromToday = (dateYmd: string): number => {
            if (dateYmd === todayStr) return 0;
            const [tY, tM, tD] = todayStr.split('-').map(Number);
            const [sY, sM, sD] = dateYmd.split('-').map(Number);
            const tDate = new Date(tY, tM - 1, tD);
            const sDate = new Date(sY, sM - 1, sD);
            const diffMs = sDate.getTime() - tDate.getTime();
            return Math.round(diffMs / (1000 * 60 * 60 * 24));
          };

          const getFilterDateLabel = (dateYmd: string): string => {
            const offset = getDayOffsetFromToday(dateYmd);
            if (offset === 0) return '☀️ Today';
            if (offset === -1) return '📅 Yesterday';

            const [y, m, d] = dateYmd.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const formatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `📅 ${formatted}`;
          };

          const isPastSelected = dateFilter === 'date' && selectedFilterDateYmd < todayStr;
          const activeSnapshot = dailySnapshots.find((s) => s.targetDateYmd === selectedFilterDateYmd);

          return (
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Indicator Pill & Actions */}
              {isPastSelected && activeSnapshot && activeSnapshot.isLocked !== false && (
                <div className="flex items-center gap-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg shadow-2xs whitespace-nowrap">
                    🔒 Finalized Snapshot
                  </span>
                  {canManageYptChallenges && (
                    <button
                      type="button"
                      onClick={() => onOpenLockDayModal(selectedFilterDateYmd)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      title="Re-lock or review snapshot for this date"
                    >
                      <Settings className="w-3 h-3 text-slate-400" />
                      <span>Manage</span>
                    </button>
                  )}
                </div>
              )}
              {isPastSelected && activeSnapshot && activeSnapshot.isLocked === false && (
                <div className="flex items-center gap-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg shadow-2xs whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span>Live Accumulating</span>
                  </span>
                  {canManageYptChallenges && (
                    <button
                      type="button"
                      onClick={() => onOpenLockDayModal(selectedFilterDateYmd)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      title="Lock and finalize day"
                    >
                      <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Finalize</span>
                    </button>
                  )}
                </div>
              )}
              {isPastSelected && !activeSnapshot && (
                <div className="flex items-center gap-1">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg whitespace-nowrap"
                    title="No finalized snapshot. Auto-penalties prevented."
                  >
                    <AlertCircle className="w-3 h-3 text-slate-400" />
                    <span>Historical Unsynced</span>
                  </span>
                  {canManageYptChallenges && (
                    <button
                      type="button"
                      onClick={() => onOpenLockDayModal(selectedFilterDateYmd)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      title="Lock and snapshot this past day"
                    >
                      <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Lock Day</span>
                    </button>
                  )}
                </div>
              )}
              {dateFilter === 'allTime' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-lg shadow-2xs whitespace-nowrap">
                  🏆 Cumulative Tournament Totals
                </span>
              )}

              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold overflow-x-auto max-w-full shrink-0">
                {/* Single Date Navigator Pill with Left/Right Arrows */}
                <div
                  className={`flex items-center rounded-lg transition-all ${
                    dateFilter === 'date'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-100 dark:border-indigo-950/60'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPrevDateDisabled) {
                        const [y, m, d] = selectedFilterDateYmd.split('-').map(Number);
                        const dateObj = new Date(y, m - 1, d);
                        dateObj.setDate(dateObj.getDate() - 1);
                        const nextYmd = getLocalYmd(dateObj);
                        if (nextYmd >= minFilterDateYmd) {
                          setSelectedFilterDateYmd(nextYmd);
                          setDateFilter('date');
                        }
                      }
                    }}
                    disabled={isPrevDateDisabled}
                    className="p-1 sm:p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-l-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={`Previous day (challenge start: ${formatShortDate(minFilterDateYmd)})`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDateFilter('date')}
                    className="px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    {getFilterDateLabel(selectedFilterDateYmd)}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isNextDateDisabled) {
                        const [y, m, d] = selectedFilterDateYmd.split('-').map(Number);
                        const dateObj = new Date(y, m - 1, d);
                        dateObj.setDate(dateObj.getDate() + 1);
                        const nextYmd = getLocalYmd(dateObj);
                        if (nextYmd <= maxFilterDateYmd) {
                          setSelectedFilterDateYmd(nextYmd);
                          setDateFilter('date');
                        }
                      }
                    }}
                    disabled={isNextDateDisabled}
                    className="p-1 sm:p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-r-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      isNextDateDisabled
                        ? `End of challenge period reached (${formatShortDate(maxFilterDateYmd)})`
                        : 'Next day'
                    }
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* All-Time Pill */}
                <button
                  type="button"
                  onClick={() => setDateFilter('allTime')}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs rounded-lg transition-all font-bold whitespace-nowrap ${
                    dateFilter === 'allTime'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-100 dark:border-indigo-950/60'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  🏆 All-Time
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* YPT Historical Day Log Feedback Banner */}
      {dayLogFeedback && (
        <div
          className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 text-xs transition-all shadow-xs ${
            dayLogFeedback.type === 'success'
              ? 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/80 text-sky-900 dark:text-sky-200'
              : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 font-bold">
              {dayLogFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{dayLogFeedback.message}</span>
            </div>
            {dayLogFeedback.subjects && dayLogFeedback.subjects.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                  Subjects breakdown:
                </span>
                {dayLogFeedback.subjects.map((sub: any, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold bg-white/90 dark:bg-slate-900/90 border border-sky-200 dark:border-sky-800 rounded-lg shadow-2xs"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: sub.color || '#0284C7' }}
                    />
                    <span>
                      {sub.name}: {sub.hours}h
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDayLogFeedback(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
