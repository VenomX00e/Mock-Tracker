import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Users, User, UserCheck, ShieldAlert, Clock, ArrowLeft, CheckCircle2, Award, RefreshCw, Calendar, Settings, Trash2, Crown, Pencil, Plus, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, AlertTriangle, LayoutGrid, Columns, Zap, Lock, Unlock, AlertCircle, TrendingUp, Flame, Medal, Sparkles, Pause, Play } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { useAppStateCtx, useUserProfileCtx, useAuthCtx } from '../../../context/AppContext';
import { YptChallenge, YptExtractedMemberData, YptSubmissionLog, YptTeam, YptApiMember, YptDailyDaySnapshot, YptTeamMemberRef, YptParticipantStandingSnapshot } from '../../../types/yptTypes';
import { getYptSubmissionLogs, recalculateTeamPointsFromSubmissions, softDeleteYptChallenge, getDeduplicatedDailyMemberStats, addYptSubmissionLog, completeYptChallenge, reopenYptChallenge, fetchYptRoster, calculatePointsFromRules, autoCloseMissingDays, getAllDailySnapshots, lockDaySnapshot, deleteDailySnapshot, resetTodayChallengeData, fetchYptDayLog, syncDayLogToChallenge, syncChallengeDaySnapshotWithHighWaterMark } from '../../../services/yptService';
import { formatStudyDuration, getLocalYmd, getYptDayYmd, getYesterdayYptDayYmd, applyHighWaterMark, isYptReconciliationWindow, areYptHandlesMatching, getChallengeStartDateYmd, getChallengeEndDateYmd, formatDisplayYmd, getMemberStudyHoursFromApi, evaluateMemberDailyPoints } from '../../../utils/yptUtils';
import { CreateYptChallengeModal } from './CreateYptChallengeModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { YptUploadModal } from './YptUploadModal';
import { YptMemberEditModal } from './YptMemberEditModal';
import { YptPerformanceTrendsChart } from './YptPerformanceTrendsChart';
import { YptIndividualStandings, CalculatedParticipant } from './YptIndividualStandings';

interface YptChallengeDetailProps {
  challenge: YptChallenge;
  onBack: () => void;
  onRefresh: () => void;
}

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

export function YptChallengeDetail({ challenge, onBack, onRefresh }: YptChallengeDetailProps) {
  const { isOwner, isAdmin } = useAppStateCtx();
  const { profile: userProfile } = useUserProfileCtx();
  const { user } = useAuthCtx();

  const isSoloMode = (challenge.mode || 'team') === 'individual';

  const isGlobalAdmin =
    isOwner ||
    isAdmin ||
    userProfile?.role === 'admin' ||
    Boolean(userProfile?.permissions?.canManageYpt) ||
    challenge.leaderUid === user?.uid;

  const canManageYptChallenges = isGlobalAdmin;

  // Build array of current user's handles (lowercased without @ prefix)
  const userYptHandles = [
    userProfile?.defaultYptHandle,
    ...(userProfile?.yptNames || []),
    userProfile?.displayName,
    user?.displayName,
    user?.email?.split('@')[0],
  ]
    .filter((h): h is string => Boolean(h && typeof h === 'string'))
    .map((h) => h.toLowerCase().replace(/^@/, '').trim());

  // Permission Resolver: check if current user can edit a member
  const canEditMember = (teamIdOrHandle: string, _memberHandle?: string): boolean => {
    if (isGlobalAdmin) return true;

    if (isSoloMode) {
      return isGlobalAdmin;
    }

    const targetTeam = (challenge.teams || []).find((t) => t.id === teamIdOrHandle || t.name === teamIdOrHandle);
    if (!targetTeam || !Array.isArray(targetTeam.teamLeaders)) return false;

    const isAssignedLeaderOfTeam = targetTeam.teamLeaders.some((handle) =>
      userYptHandles.includes(handle.toLowerCase().replace(/^@/, '').trim())
    );

    return isAssignedLeaderOfTeam;
  };

  const [submissions, setSubmissions] = useState<YptSubmissionLog[]>([]);
  const [dailySnapshots, setDailySnapshots] = useState<YptDailyDaySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveRosterMembers, setLiveRosterMembers] = useState<YptApiMember[]>([]);
  const [isLiveRosterLoading, setIsLiveRosterLoading] = useState(false);
  const [liveRosterError, setLiveRosterError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetTodayConfirm, setShowResetTodayConfirm] = useState(false);
  const [dateFilter, setDateFilter] = useState<'date' | 'allTime'>('date');
  const [selectedFilterDateYmd, setSelectedFilterDateYmd] = useState<string>(getYptDayYmd());
  const [editingMemberHandle, setEditingMemberHandle] = useState<string | null>(null);
  const [quickRulePopoverMember, setQuickRulePopoverMember] = useState<string | null>(null);
  const [expandedTeamBreakdownId, setExpandedTeamBreakdownId] = useState<string | null>(null);
  const [expandedParticipantBreakdownHandle, setExpandedParticipantBreakdownHandle] = useState<string | null>(null);
  const [teamViewMode, setTeamViewMode] = useState<'grid' | 'swipe'>('grid');
  const [soloViewMode, setSoloViewMode] = useState<'cards' | 'table'>('cards');
  const [showTrendsChart, setShowTrendsChart] = useState(false);
  const [isDeclareResultsModalOpen, setIsDeclareResultsModalOpen] = useState(false);
  const [isSubmittingResults, setIsSubmittingResults] = useState(false);
  const [isLockDayModalOpen, setIsLockDayModalOpen] = useState(false);
  const [isLockingDay, setIsLockingDay] = useState(false);
  const [lockTargetDateYmd, setLockTargetDateYmd] = useState<string>(getYesterdayYptDayYmd());
  const [isSyncingDayLog, setIsSyncingDayLog] = useState(false);
  const [isResettingToday, setIsResettingToday] = useState(false);
  const [isAutoFetchPaused, setIsAutoFetchPaused] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ypt_auto_fetch_paused') === 'true';
    } catch {
      return false;
    }
  });

  const toggleAutoFetchPause = () => {
    setIsAutoFetchPaused((prev) => {
      const next = !prev;
      try {
        if (next) {
          localStorage.setItem('ypt_auto_fetch_paused', 'true');
        } else {
          localStorage.removeItem('ypt_auto_fetch_paused');
        }
      } catch (e) {
        console.warn('Could not save auto-fetch pause state to localStorage', e);
      }
      if (!next) {
        // Trigger live fetch immediately upon resume
        fetchLiveRoster();
      }
      return next;
    });
  };
  const [dayLogFeedback, setDayLogFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    subjects?: any[];
  } | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const handleSyncYptDayLog = async (dateYmd: string) => {
    setIsSyncingDayLog(true);
    setDayLogFeedback(null);
    try {
      let targetHandle = userProfile?.defaultYptHandle || userProfile?.yptNames?.[0] || '';
      const result = await syncDayLogToChallenge(challenge, dateYmd, targetHandle);
      setDayLogFeedback({
        type: 'success',
        message: result.message,
        subjects: result.subjects,
      });
      await fetchLogs();
      onRefresh();
    } catch (err: any) {
      setDayLogFeedback({
        type: 'error',
        message: err.message || 'Failed to sync YPT day log',
      });
    } finally {
      setIsSyncingDayLog(false);
    }
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 320;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };


  const formatShortDate = (ymd: string): string => {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) return ymd;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    if (!challenge) return;
    const minDate = getChallengeStartDateYmd(challenge);
    const maxDate = getChallengeEndDateYmd(challenge);

    if (selectedFilterDateYmd > maxDate) {
      setSelectedFilterDateYmd(maxDate);
    } else if (selectedFilterDateYmd < minDate) {
      setSelectedFilterDateYmd(minDate);
    }
  }, [challenge?.id, challenge?.startDate, challenge?.endDate]);

  const getTargetDateYmdForFilter = () => {
    if (dateFilter === 'allTime') {
      return getYptDayYmd();
    }
    return selectedFilterDateYmd;
  };

  const handleApplyQuickRule = async (
    memberHandleRaw: string,
    ruleToApply: { id?: string; name: string; emoji: string; points: number }
  ) => {
    setQuickRulePopoverMember(null);
    const cleanHandle = memberHandleRaw.replace(/^@/, '').trim().toLowerCase();
    const targetYmd = getTargetDateYmdForFilter();

    const existingSub = submissions.find((sub) => {
      const subDate = sub.targetDateYmd || sub.dateYmd || getLocalYmd(sub.timestamp);
      if (subDate !== targetYmd) return false;
      return (sub.extractedMembers || []).some(
        (m) => m.yptHandle && areYptHandlesMatching(m.yptHandle, memberHandleRaw, m.matchedUid)
      );
    });

    let currentHours = 0;
    let currentRules: Array<{ ruleId?: string; ruleName: string; emoji: string; points: number }> = [];

    if (existingSub) {
      const memberData = existingSub.extractedMembers.find(
        (m) => m.yptHandle && areYptHandlesMatching(m.yptHandle, memberHandleRaw, m.matchedUid)
      );
      if (memberData) {
        currentHours = memberData.hoursStudied || 0;
        currentRules = memberData.detectedRules ? [...memberData.detectedRules] : [];
      }
    }

    const exists = currentRules.some(
      (r) => (ruleToApply.id && r.ruleId === ruleToApply.id) || r.ruleName.toLowerCase() === ruleToApply.name.toLowerCase()
    );

    if (!exists) {
      currentRules.push({
        ruleId: ruleToApply.id,
        ruleName: ruleToApply.name,
        emoji: ruleToApply.emoji,
        points: ruleToApply.points,
      });
    }

    const rules = challenge.rules;
    const intervalVal = rules.studyIntervalValue ?? 1;
    const intervalUnit = rules.studyIntervalUnit ?? 'hours';
    const intervalHours = intervalUnit === 'minutes' ? intervalVal / 60 : intervalVal || 1;
    const ptsPerInterval = rules.pointsPerInterval ?? rules.pointsPerStudyHour ?? 1;

    const basePoints = Math.floor(currentHours / (intervalHours || 1)) * ptsPerInterval;
    const ruleSum = currentRules.reduce((sum, r) => sum + (r.points || 0), 0);
    const newTotalPoints = basePoints + ruleSum;

    const extractedMemberData: YptExtractedMemberData = {
      yptHandle: cleanHandle,
      hoursStudied: currentHours,
      pointsEarned: newTotalPoints,
      morningSnap: false,
      detectedRules: currentRules,
    };

    await addYptSubmissionLog(challenge.id, {
      uploaderUid: user?.uid || 'admin_quick_rule',
      imageUrl: '',
      extractedMembers: [extractedMemberData],
      status: 'verified',
      targetDateYmd: targetYmd,
      dateYmd: targetYmd,
    });

    await recalculateTeamPointsFromSubmissions(challenge.id);
    await fetchLogs();
    onRefresh();
  };

  const handleRemoveBadge = async (
    memberHandleRaw: string,
    badgeToRemove: { emoji: string; name: string; points: number }
  ) => {
    const cleanHandle = memberHandleRaw.replace(/^@/, '').trim().toLowerCase();
    const targetYmd = getTargetDateYmdForFilter();

    const existingSub = submissions.find((sub) => {
      const subDate = sub.targetDateYmd || sub.dateYmd || getLocalYmd(sub.timestamp);
      if (subDate !== targetYmd) return false;
      return (sub.extractedMembers || []).some(
        (m) => m.yptHandle && areYptHandlesMatching(m.yptHandle, memberHandleRaw, m.matchedUid)
      );
    });

    if (!existingSub) return;

    const memberData = existingSub.extractedMembers.find(
      (m) => m.yptHandle && areYptHandlesMatching(m.yptHandle, memberHandleRaw, m.matchedUid)
    );

    if (!memberData || !Array.isArray(memberData.detectedRules)) return;

    const currentHours = memberData.hoursStudied || 0;
    const updatedRules = memberData.detectedRules.filter(
      (r) => r.ruleName.toLowerCase() !== badgeToRemove.name.toLowerCase() && r.emoji !== badgeToRemove.emoji
    );

    const rules = challenge.rules;
    const intervalVal = rules.studyIntervalValue ?? 1;
    const intervalUnit = rules.studyIntervalUnit ?? 'hours';
    const intervalHours = intervalUnit === 'minutes' ? intervalVal / 60 : intervalVal || 1;
    const ptsPerInterval = rules.pointsPerInterval ?? rules.pointsPerStudyHour ?? 1;

    const basePoints = Math.floor(currentHours / (intervalHours || 1)) * ptsPerInterval;
    const ruleSum = updatedRules.reduce((sum, r) => sum + (r.points || 0), 0);
    const newTotalPoints = basePoints + ruleSum;

    const extractedMemberData: YptExtractedMemberData = {
      yptHandle: cleanHandle,
      hoursStudied: currentHours,
      pointsEarned: newTotalPoints,
      morningSnap: false,
      detectedRules: updatedRules,
    };

    await addYptSubmissionLog(challenge.id, {
      uploaderUid: user?.uid || 'admin_quick_rule',
      imageUrl: '',
      extractedMembers: [extractedMemberData],
      status: 'verified',
      targetDateYmd: targetYmd,
      dateYmd: targetYmd,
    });

    await recalculateTeamPointsFromSubmissions(challenge.id);
    await fetchLogs();
    onRefresh();
  };

  const fetchLiveRoster = async () => {
    setIsLiveRosterLoading(true);
    setLiveRosterError(null);
    try {
      const resolvedGids = [
        ...(challenge.targetGroupIds || []),
        ...((challenge as any).groupIds || []),
        ...((challenge as any).yptGroupId ? [(challenge as any).yptGroupId] : []),
        ...(((challenge as any).groups || []).map((g: any) => g.id || g.gid || g)),
      ]
        .map(Number)
        .filter((id) => !isNaN(id) && id > 0);

      const gids = resolvedGids.length > 0 ? Array.from(new Set(resolvedGids)) : undefined;
      const { roster } = await fetchYptRoster(gids);
      const activeRoster = roster || [];
      setLiveRosterMembers(activeRoster);

      // Principle B: High-Water Mark Non-Destructive Update Pattern
      // Continuously persist the highest peak study hours so 5 AM resets never wipe data
      if (activeRoster.length > 0) {
        try {
          const liveSnapshot = await syncChallengeDaySnapshotWithHighWaterMark(challenge, activeRoster);
          setDailySnapshots((prev) => {
            const existsIdx = prev.findIndex((s) => s.targetDateYmd === liveSnapshot.targetDateYmd);
            if (existsIdx >= 0) {
              const copy = [...prev];
              copy[existsIdx] = liveSnapshot;
              return copy;
            }
            return [...prev, liveSnapshot];
          });
        } catch (snapErr) {
          console.warn('Non-fatal error updating high-water mark snapshot:', snapErr);
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch live YPT roster for direct study time display:', err);
      setLiveRosterError(err.message || 'Failed to fetch live YPT study times');
    } finally {
      setIsLiveRosterLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Auto-close any unfinalized past days into daily snapshot records (Frontend Self-Healing)
      try {
        const { closedCount } = await autoCloseMissingDays(challenge);
        if (closedCount > 0) {
          onRefresh();
        }
      } catch (autoErr) {
        console.warn('Auto-closer engine check encountered non-fatal error:', autoErr);
      }

      const [logs, snapshots] = await Promise.all([
        getYptSubmissionLogs(challenge.id),
        getAllDailySnapshots(challenge.id),
      ]);
      setSubmissions(logs);
      setDailySnapshots(snapshots || []);
      if (!isAutoFetchPaused) {
        await fetchLiveRoster();
      }
    } catch (e) {
      console.error('Error fetching YPT submission logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [challenge.id]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await recalculateTeamPointsFromSubmissions(challenge.id);
      await fetchLogs();
      onRefresh();
    } catch (e) {
      console.error('Error recalculating points:', e);
    } finally {
      setRecalculating(false);
    }
  };


  const handleSoftDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleResetTodayData = () => {
    if (!challenge) return;
    setShowResetTodayConfirm(true);
  };

  const executeResetTodayData = async () => {
    if (!challenge) return;
    const todayYmd = getYptDayYmd();
    try {
      setIsResettingToday(true);
      await resetTodayChallengeData(challenge.id, todayYmd);
      setShowResetTodayConfirm(false);
      await onRefresh();
      // Re-trigger live fetch to get clean current live data
      fetchLiveRoster();
    } catch (err: any) {
      console.error('Failed to reset today data:', err);
      setDayLogFeedback({
        type: 'error',
        message: 'Failed to reset today data: ' + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setIsResettingToday(false);
    }
  };

  const confirmSoftDelete = async () => {
    setIsDeleting(true);
    try {
      await softDeleteYptChallenge(challenge.id);
      onRefresh();
      onBack();
    } catch (err: any) {
      console.error('Failed to soft delete challenge:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const totalPointsAllTeams = (challenge.teams || []).reduce((acc, t) => acc + (t.totalPoints || 0), 0) || 1;

  return (
    <div className="space-y-6">
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
                onClick={handleResetTodayData}
                disabled={isResettingToday}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                title="Purge leaked 12:01 hours and reset Today's leaderboard back to 0:00"
              >
                <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0 ${isResettingToday ? 'animate-spin' : ''}`} />
                <span>{isResettingToday ? 'Resetting...' : "Reset Today's Data"}</span>
              </button>

              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                title={isSoloMode ? "Manage Participants & Settings" : "Edit Challenge Settings"}
              >
                {isSoloMode ? (
                  <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-500 shrink-0" />
                ) : (
                  <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                )}
                <span>{isSoloMode ? 'Manage Participants' : 'Settings'}</span>
              </button>

              <button
                onClick={handleSoftDelete}
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
      <div className={`relative overflow-hidden ${
        isSoloMode
          ? 'bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 border-purple-500/30'
          : 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-indigo-500/30'
      } p-4 sm:p-7 rounded-3xl border text-white shadow-xl space-y-3 sm:space-y-5`}>
        {/* Subtle decorative glow */}
        <div className={`absolute -top-24 -right-24 w-64 h-64 ${isSoloMode ? 'bg-purple-500/15' : 'bg-indigo-500/15'} rounded-full blur-3xl pointer-events-none`} />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-extrabold uppercase tracking-wider border shadow-xs ${
                challenge.status === 'active'
                  ? isSoloMode
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              }`}>
                {isSoloMode ? (
                  <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                ) : (
                  <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${challenge.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400'}`} />
                )}
                {challenge.status === 'active' ? 'Active' : challenge.status} {isSoloMode ? 'Individual Challenge' : 'Team Challenge'}
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
            <span className="font-semibold text-white">+{challenge.rules.pointsPerInterval ?? challenge.rules.pointsPerStudyHour} XP</span>
            <span className="text-slate-400">/ {challenge.rules.studyIntervalValue ?? 1} {challenge.rules.studyIntervalUnit ?? 'hr'}</span>
          </div>

          <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-slate-200 font-medium">
            <span className="text-rose-300 font-bold">Penalty:</span>
            <span className="font-semibold text-rose-200">-{challenge.rules.penaltyPoints} XP</span>
            <span className="text-slate-400">(&lt;{challenge.rules.penaltyThresholdValue ?? challenge.rules.noStudyPenaltyThresholdHours ?? 3} {challenge.rules.penaltyThresholdUnit ?? 'hrs'})</span>
          </div>

          {typeof challenge.rules.maxContinuousHoursThreshold === 'number' && challenge.rules.maxContinuousHoursThreshold > 0 && (
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
                  {cr.type === 'bonus' ? '+' : '-'}{cr.points} XP
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
                        {challenge.winningParticipantHandle ? challenge.winningParticipantHandle.replace(/^@/, '') : (challenge.finalMvpHandle ? challenge.finalMvpHandle.replace(/^@/, '') : 'Individual Winner')}
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

      {/* Score Comparison Arena */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 rounded-2xl space-y-4 sm:space-y-5 shadow-sm">
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
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 border transition-colors ${
                      isAutoFetchPaused
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isAutoFetchPaused
                          ? 'bg-amber-500'
                          : isLiveRosterLoading
                          ? 'bg-emerald-500 animate-ping'
                          : 'bg-emerald-500 animate-pulse'
                      }`}
                    />
                    <span>{isAutoFetchPaused ? 'Auto-Sync Paused' : 'Sync'}</span>
                    <button
                      type="button"
                      onClick={fetchLiveRoster}
                      disabled={isLiveRosterLoading}
                      className="ml-1 p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                      title="Manual one-off refresh from YPT API"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLiveRosterLoading ? 'animate-spin text-indigo-500' : ''}`} />
                    </button>
                  </span>

                  <button
                    type="button"
                    onClick={toggleAutoFetchPause}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full transition-all cursor-pointer border ${
                      isAutoFetchPaused
                        ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                    title={
                      isAutoFetchPaused
                        ? 'Auto-fetch is currently PAUSED. Click to resume automatic in-app syncing.'
                        : 'Pause in-app auto-fetching (allows isolating and testing cron-job.org background runs).'
                    }
                  >
                    {isAutoFetchPaused ? (
                      <>
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Resume Auto</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-2.5 h-2.5" />
                        <span>Pause Auto</span>
                      </>
                    )}
                  </button>
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
            const isTodaySelected = dateFilter === 'date' && selectedFilterDateYmd === todayStr;
            const activeSnapshot = dailySnapshots.find((s) => s.targetDateYmd === selectedFilterDateYmd);

            return (
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Indicator Pill & Actions */}
                {isTodaySelected && canManageYptChallenges && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleResetTodayData();
                    }}
                    disabled={isResettingToday}
                    className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-300/80 dark:border-amber-700/80 rounded-lg shadow-2xs transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap z-10"
                    title="Purge leaked hours and reset Today's leaderboard back to 0:00"
                  >
                    <RefreshCw className={`w-3 h-3 text-amber-500 shrink-0 ${isResettingToday ? 'animate-spin' : ''}`} />
                    <span>{isResettingToday ? 'Resetting...' : "Reset Today's Data"}</span>
                  </button>
                )}

                {isPastSelected && activeSnapshot && activeSnapshot.isLocked !== false && (
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg shadow-2xs whitespace-nowrap">
                      🔒 Finalized Snapshot
                    </span>
                    {canManageYptChallenges && (
                      <button
                        type="button"
                        onClick={() => {
                          setLockTargetDateYmd(selectedFilterDateYmd);
                          setIsLockDayModalOpen(true);
                        }}
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
                        onClick={() => {
                          setLockTargetDateYmd(selectedFilterDateYmd);
                          setIsLockDayModalOpen(true);
                        }}
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
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg whitespace-nowrap" title="No finalized snapshot. Auto-penalties prevented.">
                      <AlertCircle className="w-3 h-3 text-slate-400" />
                      <span>Historical Unsynced</span>
                    </span>
                    {canManageYptChallenges && (
                      <button
                        type="button"
                        onClick={() => {
                          setLockTargetDateYmd(selectedFilterDateYmd);
                          setIsLockDayModalOpen(true);
                        }}
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
                      title={isNextDateDisabled ? `End of challenge period reached (${formatShortDate(maxFilterDateYmd)})` : "Next day"}
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
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sub.color || '#0284C7' }} />
                      <span>{sub.name}: {sub.hours}h</span>
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

        {/* Compute Stats based on active dateFilter */}
        {(() => {
          const todayYmd = getYptDayYmd();

          const getDayOffsetFromToday = (dateYmd: string): number => {
            if (dateYmd === todayYmd) return 0;
            const [tY, tM, tD] = todayYmd.split('-').map(Number);
            const [sY, sM, sD] = dateYmd.split('-').map(Number);
            const tDate = new Date(tY, tM - 1, tD);
            const sDate = new Date(sY, sM - 1, sD);
            const diffMs = sDate.getTime() - tDate.getTime();
            return Math.round(diffMs / (1000 * 60 * 60 * 24));
          };

          const getFilterDateLabel = (dateYmd: string): string => {
            const offset = getDayOffsetFromToday(dateYmd);
            if (offset === 0) return 'Today';
            if (offset === -1) return 'Yesterday';

            const [y, m, d] = dateYmd.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          };

          let filterPeriodLabel = 'day';
          let filterTitleLabel = getFilterDateLabel(selectedFilterDateYmd);
          if (dateFilter === 'allTime') {
            filterPeriodLabel = 'total';
            filterTitleLabel = 'All-Time';
          }

          // Deduplicate submissions per member & date to ensure same-day replacements
          const deduplicatedDailyStats = getDeduplicatedDailyMemberStats(submissions, challenge);

          // Identify all past finalized daily snapshots
          const pastClosedSnapshots = dailySnapshots.filter((s) => s.targetDateYmd < todayYmd && s.isLocked !== false);
          const pastClosedDates = new Set(pastClosedSnapshots.map((s) => s.targetDateYmd));
          const activeSnapshot = dailySnapshots.find((s) => s.targetDateYmd === selectedFilterDateYmd);

          // Global top scorer candidate for period
          let globalTopScorerHandle: string | null = null;
          let globalTopScorerPoints = -Infinity;

          // Helper to calculate statistics for a single participant/member across historical snapshots & live streams
          const calculateMemberStats = (handleRaw: string, targetUd?: number) => {
            const cleanHandle = handleRaw.replace(/^@/, '').trim().toLowerCase();

            let periodHours = 0;
            let periodPoints = 0;
            let cumulativeHours = 0;
            let cumulativePoints = 0;

            const periodBadgeMap = new Map<string, { emoji: string; name: string; points: number; count: number; isTeamAll?: boolean }>();

            // 1. Add historical hours and points from all past finalized snapshots
            pastClosedSnapshots.forEach((snap) => {
              const rec = (snap.memberRecords || []).find((r) =>
                areYptHandlesMatching(r.yptHandle, handleRaw, r.userId)
              );
              const memberSnap = snap.memberSnapshots?.[cleanHandle];

              if (rec || memberSnap) {
                cumulativeHours += memberSnap ? memberSnap.hoursStudied : (rec?.hoursStudied || 0);
                cumulativePoints += memberSnap ? memberSnap.netPoints : (rec?.netPoints || 0);

                if (dateFilter === 'allTime') {
                  const rulesList = memberSnap?.appliedRuleBreakdown || rec?.appliedRules || [];
                  rulesList.forEach((ar: any) => {
                    const key = ar.ruleId || ar.ruleName || ar.emoji;
                    const existing = periodBadgeMap.get(key);
                    if (existing) {
                      existing.count += 1;
                    } else {
                      periodBadgeMap.set(key, {
                        emoji: ar.emoji || '⭐',
                        name: ar.ruleName,
                        points: ar.points || 0,
                        count: 1,
                        isTeamAll: false,
                      });
                    }
                  });
                }
              }
            });

            // 2. Add unclosed past submission stats
            const memberDailyStats = deduplicatedDailyStats.filter(
              (s) => areYptHandlesMatching(s.memberHandle, handleRaw, s.matchedUid, targetUd ? String(targetUd) : undefined)
            );

            memberDailyStats.forEach((stat) => {
              if (stat.dateYmd < todayYmd && !pastClosedDates.has(stat.dateYmd)) {
                cumulativeHours += stat.hoursStudied || 0;
                cumulativePoints += stat.pointsEarned || 0;

                if (dateFilter === 'allTime' && Array.isArray(stat.detectedRules)) {
                  stat.detectedRules.forEach((dr) => {
                    const key = dr.ruleId || dr.ruleName || dr.emoji;
                    const existing = periodBadgeMap.get(key);
                    if (existing) {
                      existing.count += 1;
                    } else {
                      periodBadgeMap.set(key, {
                        emoji: dr.emoji || '✨',
                        name: dr.ruleName,
                        points: dr.points || 0,
                        count: 1,
                        isTeamAll: false,
                      });
                    }
                  });
                }
              }
            });

            // 3. Compute Today's live / verified gain
            let todayLiveHours = 0;
            let todayLivePoints = 0;

            const todayStat = memberDailyStats.find((s) => s.dateYmd === todayYmd);
            if (todayStat) {
              todayLiveHours = todayStat.hoursStudied || 0;
              todayLivePoints = todayStat.pointsEarned || 0;

              if (Array.isArray(todayStat.detectedRules)) {
                todayStat.detectedRules.forEach((dr) => {
                  const key = dr.ruleId || dr.ruleName || dr.emoji;
                  const existing = periodBadgeMap.get(key);
                  if (existing) {
                    existing.count += 1;
                  } else {
                    periodBadgeMap.set(key, {
                      emoji: dr.emoji || '✨',
                      name: dr.ruleName,
                      points: dr.points || 0,
                      count: 1,
                      isTeamAll: false,
                    });
                  }
                });
              }
            }

            // Live YPT API Streaming for Today
            const liveMember = liveRosterMembers.find((m) => {
              if (!m) return false;
              const mHandle = (m.n || '').replace(/^@/, '').trim();
              return areYptHandlesMatching(mHandle, handleRaw, m.ud ? String(m.ud) : (targetUd ? String(targetUd) : undefined));
            });

            let apiLiveHours = 0;
            let apiLivePoints = 0;
            if (liveMember && challenge.rules) {
              apiLiveHours = getMemberStudyHoursFromApi(liveMember);
              const completedChallengeIds: number[] = [];
              if (liveMember.cls && typeof liveMember.cls === 'object') {
                Object.entries(liveMember.cls).forEach(([nativeChId, c]: [string, any]) => {
                  if (c && (c.st === 1 || c.status === 1 || c.st === true)) {
                    if (nativeChId) completedChallengeIds.push(Number(nativeChId));
                    if (c.id) completedChallengeIds.push(Number(c.id));
                  }
                });
              }
              const apiLiveMaxContMs = liveMember?.dl?.mm || 0;
              const evalResult = evaluateMemberDailyPoints(
                apiLiveHours,
                challenge.rules,
                completedChallengeIds,
                false,
                getChallengeStartDateYmd(challenge),
                todayYmd,
                [],
                false,
                apiLiveMaxContMs
              );
              apiLivePoints = evalResult.netPoints;

              if (apiLiveHours > todayLiveHours) {
                todayLiveHours = apiLiveHours;
              }
              if (apiLivePoints > todayLivePoints) {
                todayLivePoints = apiLivePoints;
              }

              if (Array.isArray(evalResult.appliedRules)) {
                evalResult.appliedRules.forEach((ar) => {
                  const key = ar.ruleId || ar.ruleName || ar.emoji;
                  if (!periodBadgeMap.has(key)) {
                    periodBadgeMap.set(key, {
                      emoji: ar.emoji || '✨',
                      name: ar.ruleName,
                      points: ar.points || 0,
                      count: 1,
                      isTeamAll: false,
                    });
                  }
                });
              }
            }

            // Principle B: High-Water Mark Non-Destructive Update Pattern
            const todaySnapshot = dailySnapshots.find((s) => s.targetDateYmd === todayYmd);
            const recordedHwm = todaySnapshot?.highWaterMarks?.[cleanHandle] ?? 0;
            const recordedMaxContHwm = todaySnapshot?.maxContinuousHighWaterMarks?.[cleanHandle] ?? 0;
            if (recordedHwm > todayLiveHours) {
              todayLiveHours = recordedHwm;
              const calcHwm = evaluateMemberDailyPoints(
                todayLiveHours,
                challenge.rules,
                [],
                false,
                getChallengeStartDateYmd(challenge),
                todayYmd,
                [],
                false,
                recordedMaxContHwm
              );
              if (calcHwm.netPoints > todayLivePoints) {
                todayLivePoints = calcHwm.netPoints;
              }
            }

            // Principle C: Restore Badges & Points from Cron Snapshot (Fix for Vanishing API Data)
            if (todaySnapshot) {
              const snapRec = (todaySnapshot.memberRecords || []).find((r: any) =>
                areYptHandlesMatching(r.yptHandle, handleRaw, r.userId)
              );
              const memberSnap = todaySnapshot.memberSnapshots?.[cleanHandle];
              const snapNetPoints = snapRec ? snapRec.netPoints : (memberSnap ? memberSnap.netPoints : 0);
              const snapRules = snapRec?.appliedRules || memberSnap?.appliedRuleBreakdown || [];

              if (snapNetPoints > todayLivePoints) {
                todayLivePoints = snapNetPoints;
              }

              if (Array.isArray(snapRules) && snapRules.length > 0) {
                snapRules.forEach((ar: any) => {
                  const key = ar.ruleId || ar.ruleName || ar.emoji;
                  if (!periodBadgeMap.has(key)) {
                    periodBadgeMap.set(key, {
                      emoji: ar.emoji || '⭐',
                      name: ar.ruleName,
                      points: ar.points || 0,
                      count: 1,
                      isTeamAll: false,
                    });
                  }
                });
              }
            }

            // Cumulative total adds Today's contribution
            cumulativeHours += todayLiveHours;
            cumulativePoints += todayLivePoints;

            // 4. Module 4: Client Historical Date Navigator & State Rendering
            if (dateFilter === 'date') {
              if (selectedFilterDateYmd < todayYmd) {
                if (activeSnapshot && activeSnapshot.isLocked !== false) {
                  const snapRec = (activeSnapshot.memberRecords || []).find((r) =>
                    areYptHandlesMatching(r.yptHandle, handleRaw, r.userId)
                  );
                  const memberSnap = activeSnapshot.memberSnapshots?.[cleanHandle];

                  if (snapRec || memberSnap) {
                    periodHours = memberSnap ? memberSnap.hoursStudied : (snapRec?.hoursStudied || 0);
                    periodPoints = memberSnap ? memberSnap.netPoints : (snapRec?.netPoints || 0);
                    periodBadgeMap.clear();

                    const rulesList = memberSnap?.appliedRuleBreakdown || snapRec?.appliedRules || [];
                    rulesList.forEach((ar: any) => {
                      const key = ar.ruleId || ar.ruleName || ar.emoji;
                      periodBadgeMap.set(key, {
                        emoji: ar.emoji || '⭐',
                        name: ar.ruleName,
                        points: ar.points || 0,
                        count: 1,
                        isTeamAll: false,
                      });
                    });
                  }
                } else if (activeSnapshot && activeSnapshot.isLocked === false) {
                  const snapRec = (activeSnapshot.memberRecords || []).find((r) =>
                    areYptHandlesMatching(r.yptHandle, handleRaw, r.userId)
                  );
                  const memberSnap = activeSnapshot.memberSnapshots?.[cleanHandle];
                  const hwm = activeSnapshot.highWaterMarks?.[cleanHandle] ?? 0;
                  periodHours = memberSnap ? memberSnap.hoursStudied : (snapRec?.hoursStudied || hwm);
                  periodPoints = memberSnap ? memberSnap.netPoints : (snapRec?.netPoints || 0);
                  periodBadgeMap.clear();
                  const rulesList = memberSnap?.appliedRuleBreakdown || snapRec?.appliedRules || [];
                  rulesList.forEach((ar: any) => {
                    const key = ar.ruleId || ar.ruleName || ar.emoji;
                    periodBadgeMap.set(key, {
                      emoji: ar.emoji || '⭐',
                      name: ar.ruleName,
                      points: ar.points || 0,
                      count: 1,
                      isTeamAll: false,
                    });
                  });
                } else {
                  const statForDay = memberDailyStats.find((s) => s.dateYmd === selectedFilterDateYmd);
                  if (statForDay) {
                    periodHours = statForDay.hoursStudied || 0;
                    const evalMissing = evaluateMemberDailyPoints(
                      periodHours,
                      challenge.rules,
                      [],
                      false,
                      getChallengeStartDateYmd(challenge),
                      selectedFilterDateYmd,
                      (statForDay.detectedRules || []).map((r) => r.emoji || ''),
                      false,
                      statForDay.maxContinuousMs || 0
                    );
                    periodPoints = evalMissing.netPoints;
                    periodBadgeMap.clear();
                    if (Array.isArray(statForDay.detectedRules)) {
                      statForDay.detectedRules.forEach((dr) => {
                        const key = dr.ruleId || dr.ruleName || dr.emoji;
                        periodBadgeMap.set(key, {
                          emoji: dr.emoji || '✨',
                          name: dr.ruleName,
                          points: dr.points || 0,
                          count: 1,
                          isTeamAll: false,
                        });
                      });
                    }
                  } else {
                    periodHours = 0;
                    periodPoints = 0;
                  }
                }
              } else if (selectedFilterDateYmd === todayYmd) {
                periodHours = todayLiveHours;
                periodPoints = Math.max(0, todayLivePoints);
              }
            } else {
              periodHours = cumulativeHours;
              periodPoints = cumulativePoints;
            }

            const isLiveDay = dateFilter === 'date' && selectedFilterDateYmd === todayYmd;
            const finalPeriodBadges = Array.from(periodBadgeMap.values()).filter((badge) => {
              if (badge.name === 'Study Interval Points' || (badge as any).ruleId === 'base_study' || badge.emoji === '⏱️') {
                return false;
              }
              if (isLiveDay && (badge.points < 0 || badge.name?.toLowerCase().includes('penalty') || badge.emoji === '⚠️')) {
                return false;
              }
              return true;
            });

            return {
              handleRaw,
              cleanHandle,
              periodPoints,
              periodHours,
              cumulativePoints,
              cumulativeHours,
              periodBadges: finalPeriodBadges,
              isLiveFromApi: Boolean(liveMember && apiLiveHours > 0),
              isStudyingCurrently: Boolean(liveMember?.dl?.is || (liveMember as any)?.isStudyingCurrently),
            };
          };

          // TEAM MODE CALCULATIONS
          const processedTeams = (challenge.teams || []).map((team) => {
            const calculatedMembers = (team.memberUids || []).map((handleRaw) => {
              const memStats = calculateMemberStats(handleRaw);
              if (memStats.periodPoints > globalTopScorerPoints && memStats.periodPoints > 0) {
                globalTopScorerPoints = memStats.periodPoints;
                globalTopScorerHandle = handleRaw;
              }
              return memStats;
            });

            calculatedMembers.sort((a, b) => {
              if (dateFilter === 'allTime') {
                return b.cumulativePoints - a.cumulativePoints || b.cumulativeHours - a.cumulativeHours || b.periodPoints - a.periodPoints;
              } else {
                return b.periodPoints - a.periodPoints || b.periodHours - a.periodHours || b.cumulativePoints - a.cumulativePoints;
              }
            });

            const teamMvpHandle = calculatedMembers.length > 0 && (calculatedMembers[0].cumulativePoints > 0 || calculatedMembers[0].cumulativeHours > 0)
              ? calculatedMembers[0].handleRaw
              : null;

            const teamSilverHandle = calculatedMembers.length > 1 && (calculatedMembers[1].cumulativePoints > 0 || calculatedMembers[1].cumulativeHours > 0)
              ? calculatedMembers[1].handleRaw
              : null;

            const teamTotalPoints = calculatedMembers.reduce((sum, m) => sum + m.cumulativePoints, 0);
            const teamPeriodGain = calculatedMembers.reduce((sum, m) => sum + m.periodPoints, 0);
            const teamPeriodHours = calculatedMembers.reduce((sum, m) => sum + m.periodHours, 0);

            return {
              ...team,
              totalPoints: teamTotalPoints,
              teamPeriodGain,
              teamPeriodHours,
              calculatedMembers,
              teamMvpHandle,
              teamSilverHandle,
            };
          });

          // INDIVIDUAL MODE CALCULATIONS
          const rawParticipants: YptTeamMemberRef[] = isSoloMode
            ? (Array.isArray(challenge.participants) && challenge.participants.length > 0
                ? challenge.participants
                : (challenge.teams || []).flatMap((t) =>
                    (t.memberUids || []).map((h) => ({
                      yptUd: 0,
                      yptHandle: h,
                    }))
                  ))
            : [];

          const processedParticipants: CalculatedParticipant[] = rawParticipants.map((p) => {
            const memStats = calculateMemberStats(p.yptHandle, p.yptUd);
            return {
              ...memStats,
              yptUd: p.yptUd,
              displayName: (p as any).displayName || p.yptHandle.replace(/^@/, ''),
              rank: 1,
            };
          });

          // Sort participants
          processedParticipants.sort((a, b) => {
            if (dateFilter === 'allTime') {
              return b.cumulativePoints - a.cumulativePoints || b.cumulativeHours - a.cumulativeHours || b.periodPoints - a.periodPoints;
            } else {
              return b.periodPoints - a.periodPoints || b.periodHours - a.periodHours || b.cumulativePoints - a.cumulativePoints;
            }
          });

          // Assign ranks
          processedParticipants.forEach((p, idx) => {
            p.rank = idx + 1;
          });

          // Calculate active total points across all teams for percentage share
          const activeTotalPointsAllTeams = processedTeams.reduce(
            (sum, t) => sum + (dateFilter === 'allTime' ? t.totalPoints : t.teamPeriodGain),
            0
          );

          // Sort teams by active score descending
          const rankedTeams = [...processedTeams].sort((a, b) => {
            const scoreB = dateFilter === 'allTime' ? b.totalPoints : b.teamPeriodGain;
            const scoreA = dateFilter === 'allTime' ? a.totalPoints : a.teamPeriodGain;
            return scoreB - scoreA || b.totalPoints - a.totalPoints;
          });

          return (
            <div className="space-y-4">
              {/* Cumulative Trends Chart (Collapsible/Toggled from header) */}
              {showTrendsChart && (
                <YptPerformanceTrendsChart
                  challenge={challenge}
                  dailySnapshots={dailySnapshots}
                  submissions={submissions}
                  liveRosterMembers={liveRosterMembers}
                  isSoloMode={isSoloMode}
                />
              )}

              {/* INDIVIDUAL SOLO ROYALE ARENA */}
              {isSoloMode ? (
                <YptIndividualStandings
                  participants={processedParticipants}
                  filterPeriodLabel={filterPeriodLabel}
                  filterTitleLabel={filterTitleLabel}
                  dateFilter={dateFilter}
                  viewMode={soloViewMode}
                  canEdit={canManageYptChallenges}
                  customRules={challenge.rules?.customRules || []}
                  onEditMember={(handleRaw) => {
                    setEditingMemberHandle(handleRaw);
                  }}
                  onAwardQuickRule={(handleRaw, rule) => {
                    handleApplyQuickRule(handleRaw, {
                      id: rule.id,
                      name: rule.name,
                      emoji: rule.emoji || (rule.type === 'bonus' ? '☀️' : '📱'),
                      points: rule.type === 'bonus' ? Math.abs(rule.points) : -Math.abs(rule.points),
                    });
                  }}
                  onRemoveBadge={(handleRaw, badge) => {
                    handleRemoveBadge(handleRaw, badge);
                  }}
                />
              ) : (
                /* TEAM BATTLE ARENA */
                <div className="space-y-3 sm:space-y-4">
                  {/* Optional Navigation controls for Swipe mode */}
                  {teamViewMode === 'swipe' && rankedTeams.length > 1 && (
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pt-0.5">
                      <span className="text-[11px] font-semibold flex items-center gap-1 text-slate-600 dark:text-slate-300">
                        <span>↔️</span> Swipe horizontally to view all {rankedTeams.length} teams
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => scrollCarousel('left')}
                          className="p-1 sm:p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all cursor-pointer"
                          title="Scroll Left"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollCarousel('right')}
                          className="p-1 sm:p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all cursor-pointer"
                          title="Scroll Right"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Side-by-side Teams Grid OR Horizontal Swipe Carousel */}
                  <div
                    ref={teamViewMode === 'swipe' ? carouselRef : undefined}
                    className={
                      teamViewMode === 'swipe'
                        ? "flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 touch-pan-x scrollbar-thin scrollbar-thumb-indigo-500/30 scrollbar-track-transparent"
                        : "grid grid-cols-1 md:grid-cols-2 gap-5"
                    }
                  >
                {rankedTeams.map((team, teamIdx) => {
                  const teamPeriodGain = team.teamPeriodGain;
                  const teamPeriodHours = team.teamPeriodHours;
                  const teamScoreForBar = dateFilter === 'allTime' ? team.totalPoints : team.teamPeriodGain;
                  const pct = activeTotalPointsAllTeams > 0
                    ? Math.min(100, Math.round((teamScoreForBar / activeTotalPointsAllTeams) * 100))
                    : 0;

                  const teamWideCustomRules = (challenge.rules?.customRules || []).filter((cr) => cr.scope === 'team_all');
                  const unlockedTeamWideRules = teamWideCustomRules.filter((cr) => {
                    return team.calculatedMembers.some((m) =>
                      m.periodBadges.some((b) => (b.name === cr.name || b.emoji === cr.emoji) && b.points !== 0)
                    );
                  });

                  // Aggregate team points breakdown by emoji / custom rules
                  const teamEmojiBreakdownMap = new Map<string, { emoji: string; name: string; totalPoints: number; count: number; isTeamAll?: boolean }>();
                  let totalEmojiPoints = 0;

                  team.calculatedMembers.forEach((m) => {
                    m.periodBadges.forEach((b) => {
                      const key = b.name || b.emoji;
                      const pts = (b.points || 0) * (b.count || 1);
                      totalEmojiPoints += pts;

                      const existing = teamEmojiBreakdownMap.get(key);
                      if (existing) {
                        existing.count += (b.count || 1);
                        existing.totalPoints += pts;
                      } else {
                        teamEmojiBreakdownMap.set(key, {
                          emoji: b.emoji || '✨',
                          name: b.name || 'Rule',
                          totalPoints: pts,
                          count: b.count || 1,
                          isTeamAll: Boolean(b.isTeamAll),
                        });
                      }
                    });
                  });

                  const teamEmojiList = Array.from(teamEmojiBreakdownMap.values());
                  const activeTeamScore = dateFilter === 'allTime' ? team.totalPoints : team.teamPeriodGain;
                  const baseStudyPoints = Math.max(0, activeTeamScore - totalEmojiPoints);
                  const teamKey = team.id || team.name;
                  const isBreakdownExpanded = expandedTeamBreakdownId === teamKey;

                  return (
                    <div
                      key={team.id}
                      className={`bg-slate-50/70 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3 sm:p-4 space-y-3 flex flex-col justify-between ${
                        teamViewMode === 'swipe'
                          ? 'w-[85vw] sm:w-[420px] md:w-[480px] lg:w-[520px] shrink-0 shadow-md'
                          : ''
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Team Header Card: Name, Rank, Member Count, Period Gain & Total Score */}
                        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200/80 dark:border-slate-800/80">
                          <div className="flex items-start gap-2">
                            <span
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full shrink-0 shadow-2xs mt-0.5"
                              style={{ backgroundColor: team.color || '#6366f1' }}
                            />
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                  {team.name}
                                </h4>
                                <span
                                  className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${
                                    teamIdx === 0
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                      : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  {teamIdx === 0 ? '👑 #1 Lead' : `#${teamIdx + 1}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-slate-400 mt-0.5 flex-wrap">
                                <span>{team.calculatedMembers.length} Members</span>
                                <span>•</span>
                                <span>{filterTitleLabel}: <strong className="text-[10px] sm:text-[11px] font-bold font-mono" style={{ color: team.color || '#6366f1' }}>{formatStudyDuration(teamPeriodHours)}</strong></span>
                              </div>
                              {unlockedTeamWideRules.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                                  {unlockedTeamWideRules.map((tr, trIdx) => (
                                    <span
                                      key={trIdx}
                                      className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-2xs"
                                    >
                                      <span>✨ Team Unlocked</span>
                                      <span className="font-semibold">({tr.emoji} {tr.name}: {tr.type === 'bonus' ? '+' : '-'}{tr.points} XP Team Bonus)</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Tap target for Team Points Breakdown */}
                          <button
                            type="button"
                            onClick={() => setExpandedTeamBreakdownId(isBreakdownExpanded ? null : teamKey)}
                            className="text-right shrink-0 p-1.5 -m-1.5 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-500/20 active:scale-95 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-500/30 border border-transparent hover:border-indigo-500/30"
                            title="Tap to toggle Points Collection breakdown"
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono block group-hover:underline">
                                {team.totalPoints} XP
                              </span>
                              <ChevronDown className={`w-3.5 h-3.5 text-indigo-500 transition-transform ${isBreakdownExpanded ? 'rotate-180' : ''}`} />
                            </div>
                            <div className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                              +{teamPeriodGain} XP {filterPeriodLabel}
                            </div>
                          </button>
                        </div>

                        {/* Team Score Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: team.color || '#6366f1',
                            }}
                          />
                        </div>

                        {/* Expanded Team Points Collection Breakdown Box */}
                        {isBreakdownExpanded && (
                          <div className="p-3.5 bg-gradient-to-b from-indigo-50/90 to-white dark:from-indigo-950/40 dark:to-slate-900/90 border border-indigo-500/30 dark:border-indigo-500/40 rounded-2xl space-y-3 shadow-md text-xs animate-in fade-in duration-200">
                            <div className="flex items-center justify-between border-b border-indigo-200/50 dark:border-indigo-800/50 pb-2">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                                  <Trophy className="w-4 h-4" />
                                </div>
                                <div>
                                  <h5 className="font-extrabold text-slate-900 dark:text-white text-xs">
                                    {team.name} Points Collection
                                  </h5>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                    {filterTitleLabel} Breakdown
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedTeamBreakdownId(null)}
                                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg hover:bg-indigo-500/20"
                              >
                                Close ✕
                              </button>
                            </div>

                            {/* Stat Cards: Study Time & Points */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                                <span className="text-[10px] text-slate-400 font-medium block">⏱️ Team Study Hours</span>
                                <span className="font-mono font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                                  {formatStudyDuration(teamPeriodHours)}
                                </span>
                              </div>

                              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                                <span className="text-[10px] text-slate-400 font-medium block">⭐ Points Collected</span>
                                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm">
                                  +{teamPeriodGain} XP
                                </span>
                              </div>
                            </div>

                            {/* Points Gains Through Emojis & Base Study */}
                            <div className="space-y-1.5 pt-1">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                <span>Points Source</span>
                                <span>XP Earned</span>
                              </div>

                              {/* Base Study Hours XP */}
                              <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-950/80 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px]">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-sm">⏱️</span>
                                  <div className="truncate">
                                    <span className="font-bold text-slate-800 dark:text-slate-100 block">Base Study Duration</span>
                                    <span className="text-[9px] text-slate-400 font-mono">{formatStudyDuration(teamPeriodHours)} studied</span>
                                  </div>
                                </div>
                                <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-xs shrink-0">
                                  +{baseStudyPoints} XP
                                </span>
                              </div>

                              {/* Emoji & Rules breakdown */}
                              {teamEmojiList.length > 0 ? (
                                teamEmojiList.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-2 bg-white dark:bg-slate-950/80 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px]"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-base shrink-0">{item.emoji}</span>
                                      <div className="truncate">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold text-slate-800 dark:text-slate-100">{item.name}</span>
                                          {item.isTeamAll && (
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                                              👥 Team Rule
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[9px] text-slate-400 font-mono block">Collected {item.count} time{item.count > 1 ? 's' : ''}</span>
                                      </div>
                                    </div>

                                    <span className={`font-mono font-extrabold text-xs shrink-0 ${item.totalPoints >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                      {item.totalPoints >= 0 ? `+${item.totalPoints}` : item.totalPoints} XP
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="p-2 text-center text-[10px] text-slate-400 italic bg-white dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                  No extra emoji rule bonuses collected in this period.
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Vertical Member Cards List */}
                        <div className="space-y-2 pt-1">
                          {team.calculatedMembers.map((member, idx) => {
                            const isGlobalMvp = globalTopScorerHandle && globalTopScorerHandle === member.handleRaw;
                            const isTeamMvp = team.teamMvpHandle && team.teamMvpHandle === member.handleRaw;
                            const isTeamSilver = team.teamSilverHandle && team.teamSilverHandle === member.handleRaw && !isGlobalMvp;
                            const isAssignedLeader = team.teamLeaders?.some(
                              (l) => l.toLowerCase().replace(/^@/, '').trim() === member.cleanHandle
                            );
                            const canEditThisMember = canEditMember(team.id || team.name, member.handleRaw);

                            return (
                              <div
                                key={idx}
                                className={`p-2 sm:p-2.5 rounded-xl border space-y-1.5 flex flex-col justify-between transition-all ${
                                  isGlobalMvp
                                    ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-400/80 dark:border-amber-500/80 shadow-xs shadow-amber-500/10 ring-1 ring-amber-400/30'
                                    : isTeamMvp
                                    ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/40 dark:border-amber-500/40'
                                    : isTeamSilver
                                    ? 'bg-slate-200/40 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700/80'
                                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="min-w-0 space-y-0.5">
                                    {(isAssignedLeader || isGlobalMvp || isTeamMvp || isTeamSilver) && (
                                      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap mb-1 pl-5 sm:pl-6">
                                        {isAssignedLeader && (
                                          <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-extrabold shrink-0 flex items-center gap-0.5 border border-amber-500/40">
                                            👑 Team Leader
                                          </span>
                                        )}
                                        {isGlobalMvp ? (
                                          <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold shrink-0 flex items-center gap-0.5 border border-amber-500/30">
                                            👑 MVP
                                          </span>
                                        ) : isTeamMvp ? (
                                          <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold shrink-0 flex items-center gap-0.5 border border-amber-500/20">
                                            👑 Team MVP
                                          </span>
                                        ) : isTeamSilver ? (
                                          <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-bold shrink-0 flex items-center gap-0.5 border border-slate-300 dark:border-slate-600">
                                            🥈 2nd Contributor
                                          </span>
                                        ) : null}
                                      </div>
                                    )}

                                    <div className="font-bold text-[11px] sm:text-xs text-slate-800 dark:text-slate-100 truncate flex items-center gap-1 sm:gap-1.5 flex-wrap">
                                      <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-400 font-mono shrink-0">
                                        #{idx + 1}
                                      </span>
                                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0" style={{ backgroundColor: team.color || '#6366f1' }} />
                                      <span className="truncate">@{member.handleRaw.replace(/^@/, '')}</span>

                                      {/* Live "Now Studying" Indicator (Only for Today / Live Tab) */}
                                      {dateFilter === 'date' && selectedFilterDateYmd === todayYmd && member.isStudyingCurrently && (
                                        <span
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold border border-emerald-500/20 shrink-0"
                                          title="Currently studying on YPT"
                                        >
                                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                                          <span>Studying</span>
                                        </span>
                                      )}



                                      {canEditThisMember && (
                                        <button
                                          type="button"
                                          onClick={() => setEditingMemberHandle(member.handleRaw)}
                                          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors shrink-0"
                                          title={`Edit log & rules for @${member.handleRaw.replace(/^@/, '')}`}
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-slate-500 pl-3 sm:pl-5 flex-wrap">
                                      <span>{filterTitleLabel}: <strong className="text-[11px] sm:text-xs font-bold font-mono" style={{ color: team.color || '#6366f1' }}>{formatStudyDuration(member.periodHours)}</strong></span>
                                      <span className="text-slate-300 dark:text-slate-700">•</span>
                                      <span>Total: <strong className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 font-mono">{formatStudyDuration(member.cumulativeHours)}</strong></span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end text-right shrink-0 font-mono space-y-0.5">
                                    <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 block">
                                      Total: {member.cumulativePoints} XP
                                    </span>
                                    <span className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
                                      {member.periodPoints >= 0 ? `+${member.periodPoints}` : member.periodPoints} XP {filterPeriodLabel}
                                    </span>
                                  </div>
                                </div>

                                {/* Earned Badges & Quick Rule Actions */}
                                <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                                  {member.periodBadges.map((badge, bIdx) => {
                                    const isPenalty = badge.points < 0;
                                    return (
                                      <span
                                        key={bIdx}
                                        className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold shadow-2xs transition-all ${
                                          badge.isTeamAll
                                            ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                                            : isPenalty
                                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25'
                                        }`}
                                        title={
                                          badge.isTeamAll
                                            ? `👥 Whole Team Bonus: ${badge.name} (${badge.points >= 0 ? '+' : ''}${badge.points} XP)`
                                            : `${badge.name} (${badge.points >= 0 ? '+' : ''}${badge.points} XP)`
                                        }
                                      >
                                        {badge.isTeamAll && <span className="text-[10px]">👥</span>}
                                        <span className="text-[10px] sm:text-xs">{badge.emoji}</span>
                                        <span
                                          className={`font-mono ${
                                            badge.isTeamAll
                                              ? 'text-purple-600 dark:text-purple-400 font-extrabold'
                                              : isPenalty
                                              ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                                              : 'text-amber-600 dark:text-amber-400'
                                          }`}
                                        >
                                          {badge.points >= 0 ? `+${badge.points}` : badge.points}
                                        </span>
                                      </span>
                                    );
                                  })}

                                  {canEditThisMember && (
                                    <div className="relative inline-block">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setQuickRulePopoverMember(
                                            quickRulePopoverMember === member.handleRaw ? null : member.handleRaw
                                          )
                                        }
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-[9px] font-extrabold cursor-pointer transition-colors"
                                        title="Add Quick Emoji Rule Badge"
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span>Rule</span>
                                      </button>

                                      {/* Quick Rule Popover */}
                                      {quickRulePopoverMember === member.handleRaw && (
                                        <div className="absolute left-0 bottom-full mb-1.5 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 min-w-[200px] max-w-[260px] space-y-1 text-xs animate-in fade-in zoom-in-95 duration-150">
                                          <div className="flex items-center justify-between font-bold text-[10px] text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-slate-800">
                                            <span>Apply Rule Emoji</span>
                                            <button
                                              onClick={() => setQuickRulePopoverMember(null)}
                                              className="text-slate-400 hover:text-slate-600"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                          <div className="max-h-48 overflow-y-auto space-y-0.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleApplyQuickRule(member.handleRaw, {
                                                  name: 'Morning Snap Bonus',
                                                  emoji: '☀️',
                                                  points: challenge.rules.morningSnapBonus || 5,
                                                })
                                              }
                                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                                            >
                                              <span>☀️ Morning Snap</span>
                                              <span className="font-mono text-emerald-600">
                                                +{challenge.rules.morningSnapBonus || 5} XP
                                              </span>
                                            </button>
                                            {Array.isArray(challenge.rules.customRules) &&
                                              challenge.rules.customRules.map((cr) => (
                                                <button
                                                  key={cr.id}
                                                  type="button"
                                                  onClick={() =>
                                                    handleApplyQuickRule(member.handleRaw, {
                                                      id: cr.id,
                                                      name: cr.name,
                                                      emoji: cr.emoji || (cr.type === 'bonus' ? '☀️' : '📱'),
                                                      points:
                                                        cr.type === 'bonus'
                                                          ? Math.abs(cr.points)
                                                          : -Math.abs(cr.points),
                                                    })
                                                  }
                                                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                                                >
                                                  <span>
                                                    {cr.emoji || (cr.type === 'bonus' ? '☀️' : '📱')} {cr.name}
                                                  </span>
                                                  <span
                                                    className={`font-mono ${
                                                      cr.type === 'bonus' ? 'text-emerald-600' : 'text-rose-500'
                                                    }`}
                                                  >
                                                    {cr.type === 'bonus' ? '+' : '-'}{cr.points} XP
                                                  </span>
                                                </button>
                                              ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {member.periodBadges.length === 0 && !canEditThisMember && (
                                    <div className="text-[9px] sm:text-[10px] text-slate-400 italic pt-0.5 pl-3 sm:pl-5">
                                      No badges earned in this period
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    })()}
  </div>

      {/* Admin Results Declaration Banner (Placed below Team Score Comparison Arena and above Audit Logs) */}
      {(() => {
        const todayYmd = getYptDayYmd();
        const endDateYmd = getChallengeEndDateYmd(challenge);
        const isPastEndDate = todayYmd > endDateYmd;
        const isNotCompleted = challenge.status !== 'completed';

        if (!canManageYptChallenges || !isPastEndDate || !isNotCompleted) {
          return null;
        }

        return (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-300 dark:border-amber-800/60 p-4 sm:p-5 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-amber-100">
                      ⏳ Challenge Period Ended ({formatShortDate(endDateYmd)})
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                      Action Required
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-amber-200/80 leading-relaxed">
                    Submissions are currently open for late log uploads. As an admin, you can calculate and declare the final results once all reviews are complete.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDeclareResultsModalOpen(true)}
                className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border border-amber-400/40"
              >
                <Award className="w-4 h-4" />
                <span>Declare & Publish Final Results</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Edit Challenge Settings Modal */}
      <CreateYptChallengeModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        challengeToEdit={challenge}
        onSuccess={() => {
          setIsEditModalOpen(false);
          onRefresh();
        }}
      />

      {/* Soft Delete Confirm Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        title="Move to Recycle Bin?"
        message={`Are you sure you want to delete "${challenge.title}"? It will be moved to the Recycle Bin and can be restored anytime.`}
        confirmText="Move to Bin"
        isLoading={isDeleting}
        onConfirm={confirmSoftDelete}
        onClose={() => setShowDeleteConfirm(false)}
      />

      {/* Reset Today Data Confirm Modal */}
      <ConfirmDeleteModal
        isOpen={showResetTodayConfirm}
        title="Reset Today's Data?"
        message={`This will purge leaked hours for Today (${getYptDayYmd()}), clear challenge High-Water Marks, and reset Today's leaderboard back to 0:00.\n\nYesterday's finalized data will remain completely untouched.`}
        confirmText="Reset Today"
        isDanger={true}
        isLoading={isResettingToday}
        onConfirm={executeResetTodayData}
        onClose={() => setShowResetTodayConfirm(false)}
      />

      {/* Upload Screenshot Modal locked to this challenge */}
      <YptUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        challenges={[challenge]}
        initialChallengeId={challenge.id}
        initialDateYmd={selectedFilterDateYmd}
        onSuccess={() => {
          setIsUploadModalOpen(false);
          fetchLogs();
          onRefresh();
        }}
      />

      {/* Manual Member Edit Modal */}
      {editingMemberHandle && (
        <YptMemberEditModal
          isOpen={Boolean(editingMemberHandle)}
          onClose={() => setEditingMemberHandle(null)}
          challenge={challenge}
          memberHandle={editingMemberHandle}
          initialDateYmd={getTargetDateYmdForFilter()}
          submissions={submissions}
          onSuccess={() => {
            fetchLogs();
            onRefresh();
          }}
        />
      )}

      {/* Declare Final Results Modal */}
      {isDeclareResultsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200">
            {(() => {
              // Calculate summary stats for the modal preview
              const memberDailyStats = getDeduplicatedDailyMemberStats(submissions);
              const teamMap = new Map<string, { name: string; color: string; points: number; hours: number }>();
              const memberHoursMap = new Map<string, number>();
              const memberPointsMap = new Map<string, number>();

              (challenge.teams || []).forEach((t) => {
                teamMap.set(t.id, { name: t.name, color: t.color || '#6366f1', points: 0, hours: 0 });
              });

              let grandTotalHours = 0;

              memberDailyStats.forEach((stat) => {
                const hours = stat.hoursStudied || 0;
                const pts = stat.pointsEarned || 0;
                grandTotalHours += hours;

                const memberHandle = stat.memberHandle;
                const currMemberHours = memberHoursMap.get(memberHandle) || 0;
                memberHoursMap.set(memberHandle, currMemberHours + hours);

                const currMemberPoints = memberPointsMap.get(memberHandle) || 0;
                memberPointsMap.set(memberHandle, currMemberPoints + pts);

                const targetTeam = (challenge.teams || []).find((t) =>
                  (t.memberUids || []).some((m) => areYptHandlesMatching(m, memberHandle, stat.matchedUid))
                );

                if (targetTeam) {
                  const entry = teamMap.get(targetTeam.id);
                  if (entry) {
                    entry.points += pts;
                    entry.hours += hours;
                  }
                }
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
                  const matchingSoloRef = isSoloMode && soloChampion
                    ? (challenge.participants || []).find((p) => areYptHandlesMatching(p.yptHandle, soloChampion.handle))
                    : undefined;

                  await completeYptChallenge(challenge.id, {
                    completedBy: userProfile?.displayName || user?.email || 'admin',
                    winningTeamId: isSoloMode ? '' : (championTeam?.id || ''),
                    winningParticipantUd: matchingSoloRef?.yptUd,
                    winningParticipantHandle: isSoloMode ? (soloChampion?.handle || '') : '',
                    finalMvpHandle: isSoloMode ? (soloChampion?.handle || '') : (overallMvp?.handle || ''),
                  });
                  await recalculateTeamPointsFromSubmissions(challenge.id);
                  setIsDeclareResultsModalOpen(false);
                  onRefresh();
                } catch (err) {
                  console.error('Failed to complete challenge:', err);
                } finally {
                  setIsSubmittingResults(false);
                }
              };

              return (
                <>
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
                          {challenge.title} • {isSoloMode ? 'Solo Royale' : 'Team Battle'} • End Date: {formatShortDate(getChallengeEndDateYmd(challenge))}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDeclareResultsModalOpen(false)}
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
                                <span>{championTeam.name} ({championTeam.points} XP)</span>
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
                            {overallMvp ? `@${overallMvp.handle.replace(/^@/, '')} (${formatStudyDuration(overallMvp.hours)})` : 'No MVP'}
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
                        <li>The challenge status will be set to <strong>Completed</strong>.</li>
                        <li>It will move from <strong>Active Challenges</strong> to the <strong>Completed Challenges</strong> tab in the YPT Hub.</li>
                        <li>Participants will be able to review final rankings and stats in read-only mode.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsDeclareResultsModalOpen(false)}
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
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Manual Lock Day Snapshot Modal (Admin Override) */}
      {isLockDayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200">
            {(() => {
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
                  setIsLockDayModalOpen(false);
                } catch (err) {
                  console.error('Failed to lock day snapshot:', err);
                } finally {
                  setIsLockingDay(false);
                }
              };

              const handleExecuteUnlock = async () => {
                if (!confirm(`Are you sure you want to unlock ${formatShortDate(lockTargetDateYmd)}? It will revert to live/submission mode until closed again.`)) {
                  return;
                }
                setIsLockingDay(true);
                try {
                  await deleteDailySnapshot(challenge.id, lockTargetDateYmd);
                  await recalculateTeamPointsFromSubmissions(challenge.id);
                  await fetchLogs();
                  onRefresh();
                  setIsLockDayModalOpen(false);
                } catch (err) {
                  console.error('Failed to delete snapshot:', err);
                } finally {
                  setIsLockingDay(false);
                }
              };

              return (
                <>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                          {isAlreadyLocked ? 'Manage Day Snapshot' : 'Lock Day Snapshot'}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {challenge.title}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLockDayModalOpen(false)}
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
                          Closed: {new Date(targetSnapshot!.closedAt).toLocaleString()} ({targetSnapshot!.isAutoClosed ? 'Auto-closed' : 'Manual override'})
                          <br />
                          Total Points Awarded: <strong>{targetSnapshot!.totalPointsAwarded} XP</strong> across {targetSnapshot!.memberRecords?.length || 0} members.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
                        <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-emerald-500" />
                          Freeze Study Hours & XP
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          Freezes current study stats and rules into a permanent daily snapshot. Ideal for locking scores at the end of the day or late evening.
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
                        onClick={() => handleSyncYptDayLog(lockTargetDateYmd)}
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
                        onClick={() => setIsLockDayModalOpen(false)}
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
                </>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
