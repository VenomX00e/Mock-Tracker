import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Award } from 'lucide-react';
import { useAppStateCtx, useUserProfileCtx, useAuthCtx } from '../../../context/AppContext';
import { YptChallenge, YptApiMember, YptDailyDaySnapshot } from '../../../types/yptTypes';
import {
  softDeleteYptChallenge,
  fetchYptRoster,
  autoCloseMissingDays,
  getAllDailySnapshots,
  resetTodayChallengeData,
  syncDayLogToChallenge,
  syncChallengeDaySnapshotWithHighWaterMark,
  updateMemberInDailySnapshot,
} from '../../../services/yptService';
import {
  getYptDayYmd,
  getYesterdayYptDayYmd,
  areYptHandlesMatching,
  getChallengeStartDateYmd,
  getChallengeEndDateYmd,
} from '../../../utils/yptUtils';
import { CreateYptChallengeModal } from './CreateYptChallengeModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { YptMemberEditModal } from './YptMemberEditModal';
import { YptPerformanceTrendsChart } from './YptPerformanceTrendsChart';
import { YptIndividualStandings } from './YptIndividualStandings';
import { YptChallengeHeader, YptArenaControlsHeader } from './detail/YptChallengeHeader';
import { calculateChallengeArenaStandings } from './detail/challengeStandingsCalculator';
import { YptTeamStandingsView } from './detail/YptTeamStandingsView';
import { YptDeclareResultsModal } from './detail/YptDeclareResultsModal';
import { YptLockDayModal } from './detail/YptLockDayModal';

interface YptChallengeDetailProps {
  challenge: YptChallenge;
  onBack: () => void;
  onRefresh: () => void;
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

  const [dailySnapshots, setDailySnapshots] = useState<YptDailyDaySnapshot[]>([]);
  const [, setLoading] = useState(true);
  const [liveRosterMembers, setLiveRosterMembers] = useState<YptApiMember[]>([]);
  const [isLiveRosterLoading, setIsLiveRosterLoading] = useState(false);
  const [, setLiveRosterError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetTodayConfirm, setShowResetTodayConfirm] = useState(false);
  const [dateFilter, setDateFilter] = useState<'date' | 'allTime'>('date');
  const [selectedFilterDateYmd, setSelectedFilterDateYmd] = useState<string>(getYptDayYmd());
  const [editingMemberHandle, setEditingMemberHandle] = useState<string | null>(null);
  const [quickRulePopoverMember, setQuickRulePopoverMember] = useState<string | null>(null);
  const [expandedTeamBreakdownId, setExpandedTeamBreakdownId] = useState<string | null>(null);
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
      const targetHandle = userProfile?.defaultYptHandle || userProfile?.yptNames?.[0] || '';
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

  const getExistingCustomRulesForMember = (memberHandleRaw: string, targetYmd: string) => {
    const cleanHandle = memberHandleRaw.replace(/^@/, '').trim().toLowerCase();
    const snap = dailySnapshots.find((s) => (s.targetDateYmd || s.dateYmd) === targetYmd);
    if (!snap) return [];

    let memberSnap = snap.memberSnapshots?.[cleanHandle];
    if (!memberSnap && snap.memberSnapshots) {
      const matchKey = Object.keys(snap.memberSnapshots).find((k) =>
        areYptHandlesMatching(snap.memberSnapshots[k].handle, memberHandleRaw)
      );
      if (matchKey) memberSnap = snap.memberSnapshots[matchKey];
    }

    const memberRec = (snap.memberRecords || []).find((r) =>
      areYptHandlesMatching(r.yptHandle, memberHandleRaw, r.userId)
    );

    const rawRules = memberSnap?.appliedRuleBreakdown || memberRec?.appliedRules || [];
    return rawRules
      .filter(
        (r: any) =>
          r.ruleId !== 'base_study' &&
          r.ruleId !== 'no_study_penalty' &&
          r.ruleId !== 'max_continuous_penalty' &&
          r.ruleId !== 'manual_bonus_xp'
      )
      .map((r: any) => ({
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        emoji: r.emoji || '⭐',
        points: r.points || 0,
      }));
  };

  const handleApplyQuickRule = async (
    memberHandleRaw: string,
    ruleToApply: { id?: string; name: string; emoji: string; points: number }
  ) => {
    setQuickRulePopoverMember(null);
    const targetYmd = getTargetDateYmdForFilter();
    const currentRules = getExistingCustomRulesForMember(memberHandleRaw, targetYmd);

    const exists = currentRules.some(
      (r) =>
        (ruleToApply.id && r.ruleId === ruleToApply.id) ||
        r.ruleName.toLowerCase() === ruleToApply.name.toLowerCase()
    );

    if (!exists) {
      currentRules.push({
        ruleId: ruleToApply.id,
        ruleName: ruleToApply.name,
        emoji: ruleToApply.emoji,
        points: ruleToApply.points,
      });
    }

    await updateMemberInDailySnapshot(challenge, memberHandleRaw, targetYmd, {
      appliedRules: currentRules,
    });

    await fetchLogs();
    onRefresh();
  };

  const handleRemoveBadge = async (
    memberHandleRaw: string,
    badgeToRemove: { emoji: string; name: string; points: number }
  ) => {
    const targetYmd = getTargetDateYmdForFilter();
    const currentRules = getExistingCustomRulesForMember(memberHandleRaw, targetYmd);

    const updatedRules = currentRules.filter(
      (r) => r.ruleName.toLowerCase() !== badgeToRemove.name.toLowerCase() && r.emoji !== badgeToRemove.emoji
    );

    await updateMemberInDailySnapshot(challenge, memberHandleRaw, targetYmd, {
      appliedRules: updatedRules,
    });

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
      try {
        const { closedCount } = await autoCloseMissingDays(challenge);
        if (closedCount > 0) {
          onRefresh();
        }
      } catch (autoErr) {
        console.warn('Auto-closer engine check encountered non-fatal error:', autoErr);
      }

      const snapshots = await getAllDailySnapshots(challenge.id);
      setDailySnapshots(snapshots || []);
      await fetchLiveRoster();
    } catch (e) {
      console.error('Error fetching YPT snapshots:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [challenge.id]);

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

  const {
    todayYmd,
    filterPeriodLabel,
    filterTitleLabel,
    globalTopScorerHandle,
    processedParticipants,
    activeTotalPointsAllTeams,
    rankedTeams,
  } = calculateChallengeArenaStandings({
    challenge,
    dailySnapshots,
    liveRosterMembers,
    dateFilter,
    selectedFilterDateYmd,
    isSoloMode,
  });

  return (
    <div className="space-y-6">
      <YptChallengeHeader
        challenge={challenge}
        isSoloMode={isSoloMode}
        canManageYptChallenges={canManageYptChallenges}
        isResettingToday={isResettingToday}
        isDeleting={isDeleting}
        onBack={onBack}
        onResetTodayData={handleResetTodayData}
        onOpenEditModal={() => setIsEditModalOpen(true)}
        onSoftDelete={handleSoftDelete}
        onRefresh={onRefresh}
      />

      {/* Score Comparison Arena */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 rounded-2xl space-y-4 sm:space-y-5 shadow-sm">
        <YptArenaControlsHeader
          challenge={challenge}
          isSoloMode={isSoloMode}
          canManageYptChallenges={canManageYptChallenges}
          isLiveRosterLoading={isLiveRosterLoading}
          onFetchLiveRoster={fetchLiveRoster}
          showTrendsChart={showTrendsChart}
          setShowTrendsChart={setShowTrendsChart}
          soloViewMode={soloViewMode}
          setSoloViewMode={setSoloViewMode}
          teamViewMode={teamViewMode}
          setTeamViewMode={setTeamViewMode}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          selectedFilterDateYmd={selectedFilterDateYmd}
          setSelectedFilterDateYmd={setSelectedFilterDateYmd}
          dailySnapshots={dailySnapshots}
          onOpenLockDayModal={(ymd) => {
            setLockTargetDateYmd(ymd);
            setIsLockDayModalOpen(true);
          }}
          formatShortDate={formatShortDate}
          dayLogFeedback={dayLogFeedback}
          setDayLogFeedback={setDayLogFeedback}
        />

        <div className="space-y-4">
          {showTrendsChart && (
            <YptPerformanceTrendsChart
              challenge={challenge}
              dailySnapshots={dailySnapshots}
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
            <YptTeamStandingsView
              challenge={challenge}
              rankedTeams={rankedTeams}
              activeTotalPointsAllTeams={activeTotalPointsAllTeams}
              teamViewMode={teamViewMode}
              carouselRef={carouselRef}
              scrollCarousel={scrollCarousel}
              dateFilter={dateFilter}
              selectedFilterDateYmd={selectedFilterDateYmd}
              todayYmd={todayYmd}
              filterTitleLabel={filterTitleLabel}
              filterPeriodLabel={filterPeriodLabel}
              globalTopScorerHandle={globalTopScorerHandle}
              expandedTeamBreakdownId={expandedTeamBreakdownId}
              setExpandedTeamBreakdownId={setExpandedTeamBreakdownId}
              canEditMember={canEditMember}
              setEditingMemberHandle={setEditingMemberHandle}
              quickRulePopoverMember={quickRulePopoverMember}
              setQuickRulePopoverMember={setQuickRulePopoverMember}
              handleApplyQuickRule={handleApplyQuickRule}
            />
          )}
        </div>
      </div>

      {/* Admin Results Declaration Banner */}
      {(() => {
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
                    As an admin, you can calculate and declare the final results once all daily snapshots are finalized.
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

      {/* Manual Member Edit Modal */}
      {editingMemberHandle && (
        <YptMemberEditModal
          isOpen={Boolean(editingMemberHandle)}
          onClose={() => setEditingMemberHandle(null)}
          challenge={challenge}
          memberHandle={editingMemberHandle}
          initialDateYmd={getTargetDateYmdForFilter()}
          dailySnapshots={dailySnapshots}
          onSuccess={() => {
            fetchLogs();
            onRefresh();
          }}
        />
      )}

      {/* Declare Final Results Modal */}
      <YptDeclareResultsModal
        isOpen={isDeclareResultsModalOpen}
        onClose={() => setIsDeclareResultsModalOpen(false)}
        challenge={challenge}
        dailySnapshots={dailySnapshots}
        isSoloMode={isSoloMode}
        completedByLabel={userProfile?.displayName || user?.email || 'admin'}
        isSubmittingResults={isSubmittingResults}
        setIsSubmittingResults={setIsSubmittingResults}
        formatShortDate={formatShortDate}
        onRefresh={onRefresh}
      />

      {/* Manual Lock Day Snapshot Modal (Admin Override) */}
      <YptLockDayModal
        isOpen={isLockDayModalOpen}
        onClose={() => setIsLockDayModalOpen(false)}
        challenge={challenge}
        dailySnapshots={dailySnapshots}
        liveRosterMembers={liveRosterMembers}
        lockTargetDateYmd={lockTargetDateYmd}
        setLockTargetDateYmd={setLockTargetDateYmd}
        isLockingDay={isLockingDay}
        setIsLockingDay={setIsLockingDay}
        isSyncingDayLog={isSyncingDayLog}
        onSyncYptDayLog={handleSyncYptDayLog}
        formatShortDate={formatShortDate}
        fetchLogs={fetchLogs}
        onRefresh={onRefresh}
      />
    </div>
  );
}
