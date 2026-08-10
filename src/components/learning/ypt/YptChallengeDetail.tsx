import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Users, ShieldAlert, Clock, ArrowLeft, CheckCircle2, FileImage, Award, RefreshCw, Calendar, Settings, Trash2, Crown, Pencil, Plus, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Eraser, Undo2, Redo2, AlertTriangle, LayoutGrid, Columns } from 'lucide-react';
import { useAppStateCtx, useUserProfileCtx, useAuthCtx } from '../../../context/AppContext';
import { YptChallenge, YptExtractedMemberData, YptSubmissionLog, YptTeam } from '../../../types/yptTypes';
import { getYptSubmissionLogs, recalculateTeamPointsFromSubmissions, softDeleteYptChallenge, getDeduplicatedDailyMemberStats, addYptSubmissionLog, clearDaySubmissions, clearYptDayPoints, restoreDaySubmissions, completeYptChallenge, reopenYptChallenge } from '../../../services/yptService';
import { formatStudyDuration, getLocalYmd, areYptHandlesMatching, getChallengeStartDateYmd, getChallengeEndDateYmd, formatDisplayYmd } from '../../../utils/yptUtils';
import { CreateYptChallengeModal } from './CreateYptChallengeModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { YptUploadModal } from './YptUploadModal';
import { YptMemberEditModal } from './YptMemberEditModal';

interface HistoryAction {
  type: 'clear_day';
  targetDateYmd: string;
  clearedLogs: YptSubmissionLog[];
  timestamp: number;
}

interface YptChallengeDetailProps {
  challenge: YptChallenge;
  onBack: () => void;
  onRefresh: () => void;
}

export function YptChallengeDetail({ challenge, onBack, onRefresh }: YptChallengeDetailProps) {
  const { isOwner, isAdmin } = useAppStateCtx();
  const { profile: userProfile } = useUserProfileCtx();
  const { user } = useAuthCtx();

  const isGlobalAdmin =
    isOwner ||
    isAdmin ||
    userProfile?.role === 'admin' ||
    Boolean(userProfile?.permissions?.canManageYpt) ||
    challenge.leaderUid === user?.uid;

  const canManageYptChallenges = isGlobalAdmin;

  // Strict Authorization Rule: Creator & App Owner Check for clearing daily points
  const isChallengeCreatorOrOwner =
    userProfile?.role === 'owner' ||
    userProfile?.role === 'admin' ||
    isOwner ||
    isAdmin ||
    challenge.leaderUid === user?.uid ||
    (challenge as any).createdBy === user?.uid ||
    (challenge as any).createdByEmail === user?.email;

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

  // Permission Resolver: check if current user can edit a member in a specific team
  const canEditMember = (teamId: string, _memberHandle?: string): boolean => {
    if (isGlobalAdmin) return true;

    const targetTeam = challenge.teams.find((t) => t.id === teamId || t.name === teamId);
    if (!targetTeam || !Array.isArray(targetTeam.teamLeaders)) return false;

    const isAssignedLeaderOfTeam = targetTeam.teamLeaders.some((handle) =>
      userYptHandles.includes(handle.toLowerCase().replace(/^@/, '').trim())
    );

    return isAssignedLeaderOfTeam;
  };

  const [submissions, setSubmissions] = useState<YptSubmissionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dateFilter, setDateFilter] = useState<'date' | 'allTime'>('date');
  const [selectedFilterDateYmd, setSelectedFilterDateYmd] = useState<string>(getLocalYmd(new Date()));
  const [editingMemberHandle, setEditingMemberHandle] = useState<string | null>(null);
  const [quickRulePopoverMember, setQuickRulePopoverMember] = useState<string | null>(null);
  const [isAuditLogsCollapsed, setIsAuditLogsCollapsed] = useState(true);
  const [expandedTeamBreakdownId, setExpandedTeamBreakdownId] = useState<string | null>(null);
  const [teamViewMode, setTeamViewMode] = useState<'grid' | 'swipe'>('grid');
  const [isDeclareResultsModalOpen, setIsDeclareResultsModalOpen] = useState(false);
  const [isSubmittingResults, setIsSubmittingResults] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 320;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Undo / Redo & Clear Day Points state
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);
  const [isClearingDay, setIsClearingDay] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

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
      return getLocalYmd(new Date());
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

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const logs = await getYptSubmissionLogs(challenge.id);
      setSubmissions(logs);
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

  const handleClearSelectedDayPoints = async () => {
    if (!selectedFilterDateYmd) return;
    setIsClearingDay(true);
    try {
      const removedLogs = await clearDaySubmissions(challenge.id, selectedFilterDateYmd);
      setUndoStack((prev) => [
        ...prev,
        {
          type: 'clear_day',
          targetDateYmd: selectedFilterDateYmd,
          clearedLogs: removedLogs,
          timestamp: Date.now(),
        },
      ]);
      setRedoStack([]);
      await fetchLogs();
      onRefresh();
    } catch (err) {
      console.error("Failed to clear day's points:", err);
    } finally {
      setIsClearingDay(false);
      setIsClearConfirmOpen(false);
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const lastAction = undoStack[undoStack.length - 1];
    setIsClearingDay(true);
    try {
      if (lastAction.type === 'clear_day') {
        await restoreDaySubmissions(challenge.id, lastAction.clearedLogs);
      }
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, lastAction]);
      await fetchLogs();
      onRefresh();
    } catch (err) {
      console.error('Failed to undo clear:', err);
    } finally {
      setIsClearingDay(false);
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const nextAction = redoStack[redoStack.length - 1];
    setIsClearingDay(true);
    try {
      if (nextAction.type === 'clear_day') {
        await clearDaySubmissions(challenge.id, nextAction.targetDateYmd);
      }
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, nextAction]);
      await fetchLogs();
      onRefresh();
    } catch (err) {
      console.error('Failed to redo clear:', err);
    } finally {
      setIsClearingDay(false);
    }
  };

  const handleSoftDelete = () => {
    setShowDeleteConfirm(true);
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

  const totalPointsAllTeams = challenge.teams.reduce((acc, t) => acc + (t.totalPoints || 0), 0) || 1;

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
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl transition-all shadow-md hover:shadow-indigo-500/25 active:scale-95 whitespace-nowrap"
            title="Upload YPT Group Screenshot for this Challenge"
          >
            <FileImage className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Upload Screenshot</span>
          </button>

          {canManageYptChallenges && (
            <>
              {isChallengeCreatorOrOwner ? (
                <button
                  onClick={() => setIsClearConfirmOpen(true)}
                  disabled={isClearingDay}
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
                  title={`Clear points and screenshot submissions for ${selectedFilterDateYmd}`}
                >
                  <Eraser className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500 shrink-0 ${isClearingDay ? 'animate-spin' : ''}`} />
                  Clear {selectedFilterDateYmd === getLocalYmd(new Date()) ? "Today's" : selectedFilterDateYmd} Points
                </button>
              ) : (
                <button
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${recalculating ? 'animate-spin' : ''}`} />
                  Recalculate Points
                </button>
              )}

              {/* Undo & Redo Controls */}
              <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0 || isClearingDay}
                  className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                  title="Undo last cleared points action"
                >
                  <Undo2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500 shrink-0" />
                  <span>Undo</span>
                </button>
                <div className="w-[1px] h-3.5 sm:h-4 bg-slate-300 dark:bg-slate-700 my-auto" />
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0 || isClearingDay}
                  className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                  title="Redo cleared points action"
                >
                  <Redo2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500 shrink-0" />
                  <span>Redo</span>
                </button>
              </div>

              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap"
                title="Edit Challenge Settings"
              >
                <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                <span>Settings</span>
              </button>

              <button
                onClick={handleSoftDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
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
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-7 rounded-3xl border border-indigo-500/30 text-white shadow-xl space-y-3 sm:space-y-5">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-extrabold uppercase tracking-wider border shadow-xs ${
                challenge.status === 'active'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              }`}>
                <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${challenge.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400'}`} />
                {challenge.status} Challenge
              </span>
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium text-slate-300 bg-white/10 backdrop-blur-md border border-white/10">
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-300 shrink-0" />
                {formatDisplayYmd(challenge.startDate)} — {formatDisplayYmd(challenge.endDate)}
              </span>
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
                  cr.scope === 'team_all'
                    ? 'bg-purple-500/20 border-purple-500/35 text-purple-200'
                    : 'bg-white/10 border-white/10 text-slate-200'
                }`}
              >
                <span>{cr.emoji || (cr.type === 'bonus' ? '☀️' : '📱')}</span>
                <span className="font-bold text-white">{cr.name}:</span>
                <span className={`font-semibold ${cr.type === 'bonus' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {cr.type === 'bonus' ? '+' : '-'}{cr.points} XP
                </span>
                {cr.scope === 'team_all' && (
                  <span className="ml-0.5 text-[8px] sm:text-[9px] font-extrabold px-1 sm:px-1.5 py-0.5 rounded-md bg-purple-400/25 text-purple-100 border border-purple-300/30 uppercase tracking-wide">
                    👥 Team Rule (100%)
                  </span>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Team Score Comparison Arena */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 rounded-2xl space-y-4 sm:space-y-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500 shrink-0" /> Team Score Comparison Arena
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Live performance ranking & team standings</p>
            </div>

            {/* View Switcher Button on the text row */}
            <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold shrink-0">
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
            </div>
          </div>

          {/* Date Toggle Control: Date Navigator (Today -> Yesterday -> Date) / All-Time */}
          {(() => {
            const minFilterDateYmd = getChallengeStartDateYmd(challenge);
            const maxFilterDateYmd = getChallengeEndDateYmd(challenge);

            const isPrevDateDisabled = selectedFilterDateYmd <= minFilterDateYmd;
            const isNextDateDisabled = selectedFilterDateYmd >= maxFilterDateYmd;

            const getDayOffsetFromToday = (dateYmd: string): number => {
              const todayStr = getLocalYmd(new Date());
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

            return (
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
            );
          })()}
        </div>

        {/* Compute Stats based on active dateFilter */}
        {(() => {
          const todayObj = new Date();
          const todayYmd = getLocalYmd(todayObj);

          const getDayOffsetFromToday = (dateYmd: string): number => {
            const todayStr = getLocalYmd(new Date());
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

          // Global top scorer candidate for period
          let globalTopScorerHandle: string | null = null;
          let globalTopScorerPoints = -Infinity;

          const processedTeams = challenge.teams.map((team) => {
            const calculatedMembers = (team.memberUids || []).map((handleRaw) => {
              const cleanHandle = handleRaw.replace(/^@/, '').trim().toLowerCase();

              let periodHours = 0;
              let periodPoints = 0;
              let cumulativeHours = 0;
              let cumulativePoints = 0;

              const periodBadgeMap = new Map<string, { emoji: string; name: string; points: number; count: number; isTeamAll?: boolean }>();

              const memberDailyStats = deduplicatedDailyStats.filter(
                (s) => areYptHandlesMatching(s.memberHandle, handleRaw, s.matchedUid, undefined)
              );

              memberDailyStats.forEach((stat) => {
                const subYmd = stat.dateYmd;

                let isMatch = false;
                if (dateFilter === 'allTime') {
                  isMatch = true;
                } else {
                  isMatch = subYmd === selectedFilterDateYmd;
                }

                const hours = stat.hoursStudied || 0;
                const pts = stat.pointsEarned || 0;

                cumulativeHours += hours;
                cumulativePoints += pts;

                if (isMatch) {
                  periodHours += hours;
                  periodPoints += pts;

                  // Extract rules / badges with explicit point values
                  if (Array.isArray(stat.detectedRules) && stat.detectedRules.length > 0) {
                    stat.detectedRules.forEach((dr) => {
                      const key = dr.ruleId || dr.ruleName || dr.emoji;
                      const matchingCustomRule = Array.isArray(challenge.rules?.customRules)
                        ? challenge.rules.customRules.find(
                            (cr) => cr.id === dr.ruleId || cr.name === dr.ruleName || (cr.emoji && cr.emoji === dr.emoji)
                          )
                        : undefined;
                      const isTeamAll = matchingCustomRule?.scope === 'team_all';

                      const existing = periodBadgeMap.get(key);
                      if (existing) {
                        existing.count += 1;
                      } else {
                        periodBadgeMap.set(key, {
                          emoji: dr.emoji || '✨',
                          name: dr.ruleName,
                          points: dr.points || 0,
                          count: 1,
                          isTeamAll: Boolean(isTeamAll),
                        });
                      }
                    });
                  }
                }
              });

              // Check global candidate
              if (periodPoints > globalTopScorerPoints && periodPoints > 0) {
                globalTopScorerPoints = periodPoints;
                globalTopScorerHandle = handleRaw;
              }

              return {
                handleRaw,
                cleanHandle,
                periodPoints,
                periodHours,
                cumulativePoints,
                cumulativeHours,
                periodBadges: Array.from(periodBadgeMap.values()),
              };
            });

            // Sort members according to active date filter (period score first if period mode, cumulative score if All-Time)
            calculatedMembers.sort((a, b) => {
              if (dateFilter === 'allTime') {
                return b.cumulativePoints - a.cumulativePoints || b.cumulativeHours - a.cumulativeHours || b.periodPoints - a.periodPoints;
              } else {
                return b.periodPoints - a.periodPoints || b.periodHours - a.periodHours || b.cumulativePoints - a.cumulativePoints;
              }
            });

            // Identify Team MVP (1st) and Team Silver (2nd) contributors based on cumulative points/hours
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
                                  {member.periodBadges.map((badge, bIdx) => (
                                    <span
                                      key={bIdx}
                                      className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-bold shadow-2xs transition-all ${
                                        badge.isTeamAll
                                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
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
                                      <span className={`font-mono ${badge.isTeamAll ? 'text-purple-600 dark:text-purple-400 font-extrabold' : 'text-amber-600 dark:text-amber-400'}`}>
                                        {badge.points >= 0 ? `+${badge.points}` : badge.points}
                                      </span>
                                    </span>
                                  ))}

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
          );
        })()}
      </div>

      {/* Admin Results Declaration Banner (Placed below Team Score Comparison Arena and above Audit Logs) */}
      {(() => {
        const todayYmd = getLocalYmd(new Date());
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

      {/* Audit Log / Submissions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 rounded-2xl space-y-3 sm:space-y-4 shadow-sm">
        <div
          className="flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none group"
          onClick={() => setIsAuditLogsCollapsed(!isAuditLogsCollapsed)}
        >
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FileImage className="w-4 h-4 text-indigo-500 shrink-0" /> Screenshot Verification Audit Logs
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs text-slate-500 font-semibold">
              {Math.min(submissions.length, 3)} Log{Math.min(submissions.length, 3) !== 1 ? 's' : ''} Shown
            </span>
            <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
              {isAuditLogsCollapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>

        {!isAuditLogsCollapsed && (
          loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading audit log entries...</div>
          ) : submissions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No study screenshots uploaded yet for this challenge.
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3 max-h-80 overflow-y-auto pr-1">
              {submissions.slice(0, 3).map((sub) => {
                const targetYmd = sub.targetDateYmd || sub.dateYmd || getLocalYmd(sub.timestamp);
                const formatShortDate = (ymdStr: string) => {
                  if (!ymdStr) return '';
                  const parts = ymdStr.split('-').map(Number);
                  if (parts.length !== 3 || isNaN(parts[0])) return ymdStr;
                  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
                  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                };
                const studySessionDateStr = formatShortDate(targetYmd);
                const uploadDateStr = new Date(sub.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                const sameDateSubs = submissions.filter(
                  (s) => (s.targetDateYmd || s.dateYmd || getLocalYmd(s.timestamp)) === targetYmd
                );
                const subTs = new Date(sub.timestamp).getTime();
                const hasPreviousSubmission = sameDateSubs.some(
                  (s) => new Date(s.timestamp).getTime() < subTs
                );
                const isLatestForDate = !sameDateSubs.some(
                  (s) => new Date(s.timestamp).getTime() > subTs
                );

                return (
                  <div key={sub.id} className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[11px] sm:text-xs flex-wrap gap-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          {sub.status}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium text-[10px] sm:text-[11px]">
                          Uploaded on <strong>{uploadDateStr}</strong> for <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{studySessionDateStr}</strong> study session
                        </span>
                        {hasPreviousSubmission && isLatestForDate && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 shrink-0" />
                            <span>Updated latest submission for {studySessionDateStr}</span>
                          </span>
                        )}
                      </div>
                      <span className="font-extrabold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400">
                        +{sub.totalPointsAwarded} XP awarded
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
                      {sub.extractedMembers.map((m, i) => {
                        const emojis = Array.isArray(m.detectedEmojis) && m.detectedEmojis.length > 0
                          ? m.detectedEmojis
                          : m.morningSnap ? ['☀️'] : [];

                        return (() => {
                          let baseIntervalInHours = 1;
                          if (challenge.rules?.studyIntervalValue && challenge.rules.studyIntervalValue > 0) {
                            baseIntervalInHours = challenge.rules.studyIntervalUnit === 'minutes'
                              ? challenge.rules.studyIntervalValue / 60
                              : challenge.rules.studyIntervalValue;
                          }
                          const intervalsCompleted = baseIntervalInHours > 0 ? Math.floor(m.hoursStudied / baseIntervalInHours) : Math.floor(m.hoursStudied);
                          const ptsPerInt = typeof challenge.rules?.pointsPerInterval === 'number'
                            ? challenge.rules.pointsPerInterval
                            : (challenge.rules?.pointsPerStudyHour ?? 2);
                          const baseStudyPts = intervalsCompleted * ptsPerInt;

                          let penThreshHours = challenge.rules?.noStudyPenaltyThresholdHours || 0;
                          if (challenge.rules?.penaltyThresholdValue && challenge.rules.penaltyThresholdValue > 0) {
                            penThreshHours = challenge.rules.penaltyThresholdUnit === 'minutes'
                              ? challenge.rules.penaltyThresholdValue / 60
                              : challenge.rules.penaltyThresholdValue;
                          }
                          let penaltyPts = 0;
                          if (penThreshHours > 0 && m.hoursStudied < penThreshHours) {
                            penaltyPts = challenge.rules?.penaltyPoints ?? 5;
                          }

                          const ruleTerms = Array.isArray(m.detectedRules)
                            ? m.detectedRules.map((r) => (r.points >= 0 ? `+${r.points}` : `${r.points}`))
                            : [];
                          const penaltyTerm = penaltyPts > 0 ? `-${penaltyPts}` : '';
                          const breakdownExpr = `(${baseStudyPts}${penaltyTerm}${ruleTerms.join('')})`;

                          return (
                            <div
                              key={i}
                              className="flex flex-wrap items-center gap-1 sm:gap-1.5 bg-white dark:bg-slate-900 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[10px] sm:text-[11px] font-medium text-slate-700 dark:text-slate-300 shadow-2xs max-w-full"
                            >
                              <span className="font-bold truncate max-w-[120px] sm:max-w-[180px]">{m.yptHandle}</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono">
                                {formatStudyDuration(m.hoursStudied)}
                              </span>
                              {emojis.length > 0 && (
                                <span className="flex items-center gap-0.5 px-1 sm:px-1.5 py-0.2 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 rounded-md text-[9px] sm:text-[10px] font-bold">
                                  {emojis.join(' ')}
                                </span>
                              )}
                              {Array.isArray(m.detectedRules) &&
                                m.detectedRules.map((dr, drIdx) => {
                                  const isTeamAll = challenge.rules?.customRules?.some(
                                    (cr) => (cr.id === dr.ruleId || cr.name === dr.ruleName || cr.emoji === dr.emoji) && cr.scope === 'team_all'
                                  );
                                  return (
                                    <span
                                      key={drIdx}
                                      className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold border flex items-center gap-0.5 ${
                                        isTeamAll
                                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                                      }`}
                                      title={`${dr.ruleName}${isTeamAll ? ' (Whole Team Rule)' : ''}`}
                                    >
                                      {isTeamAll && <span className="text-[9px]">👥</span>}
                                      <span>{dr.emoji || dr.ruleName}</span>
                                    </span>
                                  );
                                })}
                              <span className={m.pointsEarned >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                                {m.pointsEarned >= 0 ? `+${m.pointsEarned}` : m.pointsEarned} XP
                              </span>
                              <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500 font-semibold">
                                {breakdownExpr}
                              </span>
                            </div>
                          );
                        })();
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

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

      {/* Clear Day Points Confirmation Modal */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <Eraser className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  Clear {selectedFilterDateYmd === getLocalYmd(new Date()) ? "Today's" : selectedFilterDateYmd} Points?
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Challenge: <span className="font-bold text-slate-700 dark:text-slate-300">{challenge.title}</span>
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 rounded-2xl text-xs space-y-2 text-rose-800 dark:text-rose-200">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                This will delete screenshot submissions and clear points recorded for {selectedFilterDateYmd}.
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                If wrong days data was added by screenshot upload, clearing this date will reset all member and team points for {selectedFilterDateYmd}. You can undo this action immediately using the Undo button.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                disabled={isClearingDay}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearSelectedDayPoints}
                disabled={isClearingDay}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isClearingDay ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Clearing Points...
                  </>
                ) : (
                  <>
                    <Eraser className="w-3.5 h-3.5" />
                    Confirm Clear Points
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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

              challenge.teams.forEach((t) => {
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

                const targetTeam = challenge.teams.find((t) =>
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

              // Champion Team
              const sortedTeamsList = Array.from(teamMap.entries()).map(([id, data]) => ({ id, ...data }));
              sortedTeamsList.sort((a, b) => b.points - a.points || b.hours - a.hours);
              const championTeam = sortedTeamsList.length > 0 ? sortedTeamsList[0] : null;

              // Overall MVP
              const sortedMembersList = Array.from(memberHoursMap.entries()).map(([handle, hours]) => ({ handle, hours }));
              sortedMembersList.sort((a, b) => b.hours - a.hours);
              const overallMvp = sortedMembersList.length > 0 && sortedMembersList[0].hours > 0 ? sortedMembersList[0] : null;

              const handleConfirmComplete = async () => {
                try {
                  setIsSubmittingResults(true);
                  await completeYptChallenge(challenge.id, {
                    completedBy: userProfile?.displayName || user?.email || 'admin',
                    winningTeamId: championTeam?.id || '',
                    finalMvpHandle: overallMvp?.handle || '',
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
                          {challenge.title} • End Date: {formatShortDate(getChallengeEndDateYmd(challenge))}
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
                          <span className="text-[10px] text-slate-400 font-medium block">🏆 Champion Team</span>
                          <span className="font-extrabold text-slate-900 dark:text-white text-xs flex items-center gap-1.5 mt-0.5">
                            {championTeam ? (
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
                          <span className="text-[10px] text-slate-400 font-medium block">👑 Challenge MVP</span>
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

    </div>
  );
}
