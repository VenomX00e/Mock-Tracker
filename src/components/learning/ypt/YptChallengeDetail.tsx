import React, { useState, useEffect } from 'react';
import { Trophy, Users, ShieldAlert, Clock, ArrowLeft, CheckCircle2, FileImage, Award, RefreshCw, Calendar, Settings, Trash2, Crown, Pencil, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStateCtx, useUserProfileCtx, useAuthCtx } from '../../../context/AppContext';
import { YptChallenge, YptExtractedMemberData, YptSubmissionLog, YptTeam } from '../../../types/yptTypes';
import { getYptSubmissionLogs, recalculateTeamPointsFromSubmissions, softDeleteYptChallenge, getDeduplicatedDailyMemberStats, addYptSubmissionLog } from '../../../services/yptService';
import { formatStudyDuration, getLocalYmd } from '../../../utils/yptUtils';
import { CreateYptChallengeModal } from './CreateYptChallengeModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { YptUploadModal } from './YptUploadModal';
import { YptMemberEditModal } from './YptMemberEditModal';

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

  const getChallengeStartDateYmd = (ch?: YptChallenge | null): string => {
    if (!ch) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return getLocalYmd(d);
    }
    const raw = ch.startDate || (ch as any).createdAt;
    if (!raw) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return getLocalYmd(d);
    }
    const str = String(raw).trim();
    if (str.includes('T')) {
      const ymd = str.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return getLocalYmd(parsed);

    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalYmd(d);
  };

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
        (m) => m.yptHandle && m.yptHandle.replace(/^@/, '').trim().toLowerCase() === cleanHandle
      );
    });

    let currentHours = 0;
    let currentRules: Array<{ ruleId?: string; ruleName: string; emoji: string; points: number }> = [];

    if (existingSub) {
      const memberData = existingSub.extractedMembers.find(
        (m) => m.yptHandle && m.yptHandle.replace(/^@/, '').trim().toLowerCase() === cleanHandle
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
        (m) => m.yptHandle && m.yptHandle.replace(/^@/, '').trim().toLowerCase() === cleanHandle
      );
    });

    if (!existingSub) return;

    const memberData = existingSub.extractedMembers.find(
      (m) => m.yptHandle && m.yptHandle.replace(/^@/, '').trim().toLowerCase() === cleanHandle
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Challenges
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl transition-all shadow-md hover:shadow-indigo-500/25 active:scale-95"
            title="Upload YPT Group Screenshot for this Challenge"
          >
            <FileImage className="w-4 h-4" />
            <span>Upload Screenshot</span>
          </button>

          {canManageYptChallenges && (
            <>
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} />
                Recalculate Points
              </button>

              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
                title="Edit Challenge Settings"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Settings</span>
              </button>

              <button
                onClick={handleSoftDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors disabled:opacity-50"
                title="Move to Recycle Bin"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Challenge Hero Header */}
      <div className="bg-gradient-to-r from-indigo-900/60 via-purple-900/50 to-slate-900/70 p-4 sm:p-6 rounded-2xl border border-indigo-500/20 space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {challenge.status} Challenge
              </span>
              <span className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(challenge.startDate).toLocaleDateString()} — {new Date(challenge.endDate).toLocaleDateString()}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">{challenge.title}</h2>
            {challenge.description && (
              <p className="text-[11px] sm:text-xs text-slate-300 mt-1 max-w-xl">{challenge.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-sm p-2.5 sm:p-3 rounded-xl border border-slate-700/50">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
            <div>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Leader Team</p>
              <p className="text-xs font-extrabold text-white">
                {[...challenge.teams].sort((a, b) => b.totalPoints - a.totalPoints)[0]?.name || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Rule Summary Bar */}
        <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1.5 pt-3 border-t border-indigo-500/20 text-[11px] sm:text-xs text-indigo-200">
          <div>
            <span className="opacity-70">Study Rate:</span> +{challenge.rules.pointsPerInterval ?? challenge.rules.pointsPerStudyHour} XP / {challenge.rules.studyIntervalValue ?? 1} {challenge.rules.studyIntervalUnit ?? 'hr'}
          </div>
          <div>
            <span className="opacity-70">Penalty:</span> -{challenge.rules.penaltyPoints} XP (&lt;{challenge.rules.penaltyThresholdValue ?? challenge.rules.noStudyPenaltyThresholdHours ?? 3} {challenge.rules.penaltyThresholdUnit ?? 'hrs'})
          </div>
          {typeof challenge.rules.morningSnapBonus === 'number' && (
            <div><span className="opacity-70">Snap Bonus:</span> +{challenge.rules.morningSnapBonus} XP</div>
          )}
          {Array.isArray(challenge.rules.customRules) &&
            challenge.rules.customRules.map((cr) => (
              <div key={cr.id} className="flex items-center gap-1">
                <span className="opacity-70">{cr.emoji ? `${cr.emoji} ` : ''}{cr.name}:</span> {cr.type === 'bonus' ? '+' : '-'}{cr.points} XP
              </div>
            ))}
        </div>
      </div>

      {/* Team Score Comparison Arena */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 rounded-2xl space-y-4 sm:space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" /> Team Score Comparison Arena
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Live performance ranking & team standings</p>
          </div>

          {/* Date Toggle Control: Date Navigator (Today -> Yesterday -> Date) / All-Time */}
          {(() => {
            const minFilterDateYmd = getChallengeStartDateYmd(challenge);
            const todayYmd = getLocalYmd(new Date());

            const isPrevDateDisabled = selectedFilterDateYmd <= minFilterDateYmd;
            const isNextDateDisabled = selectedFilterDateYmd >= todayYmd;

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
                    title={`Previous day (challenge start: ${minFilterDateYmd})`}
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
                        if (nextYmd <= todayYmd) {
                          setSelectedFilterDateYmd(nextYmd);
                          setDateFilter('date');
                        }
                      }
                    }}
                    disabled={isNextDateDisabled}
                    className="p-1 sm:p-1.5 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-r-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Next day (up to Today)"
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
          const deduplicatedDailyStats = getDeduplicatedDailyMemberStats(submissions);

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

              const periodBadgeMap = new Map<string, { emoji: string; name: string; points: number; count: number }>();

              const memberDailyStats = deduplicatedDailyStats.filter(
                (s) => s.memberHandle === cleanHandle || (s.matchedUid && cleanHandle.includes(s.matchedUid.replace(/^@/, '').trim().toLowerCase()))
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
                      const existing = periodBadgeMap.get(key);
                      if (existing) {
                        existing.count += 1;
                      } else {
                        periodBadgeMap.set(key, {
                          emoji: dr.emoji || '✨',
                          name: dr.ruleName,
                          points: dr.points || 0,
                          count: 1,
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
            <div className="space-y-5">
              {/* Side-by-side Teams Grid */}
              <div className={`grid grid-cols-1 ${rankedTeams.length > 1 ? 'md:grid-cols-2 lg:grid-cols-' + Math.min(rankedTeams.length, 3) : ''} gap-5`}>
                {rankedTeams.map((team, teamIdx) => {
                  const teamPeriodGain = team.teamPeriodGain;
                  const teamPeriodHours = team.teamPeriodHours;
                  const teamScoreForBar = dateFilter === 'allTime' ? team.totalPoints : team.teamPeriodGain;
                  const pct = activeTotalPointsAllTeams > 0
                    ? Math.min(100, Math.round((teamScoreForBar / activeTotalPointsAllTeams) * 100))
                    : 0;

                  return (
                    <div
                      key={team.id}
                      className="bg-slate-50/70 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3 sm:p-4 space-y-3 flex flex-col justify-between"
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
                            </div>
                          </div>

                          <div className="text-right shrink-0 space-y-0.5">
                            <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono block">
                              {team.totalPoints} XP
                            </span>
                            <div className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                              +{teamPeriodGain} XP {filterPeriodLabel}
                            </div>
                          </div>
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
                                      onClick={() => {
                                        if (canEditThisMember) {
                                          handleRemoveBadge(member.handleRaw, badge);
                                        }
                                      }}
                                      className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-[9px] sm:text-[10px] font-bold shadow-2xs transition-all ${
                                        canEditThisMember ? 'cursor-pointer hover:border-rose-400/80 hover:bg-rose-500/10' : ''
                                      }`}
                                      title={
                                        canEditThisMember
                                          ? `Click to remove rule "${badge.name}"`
                                          : `${badge.name} (${badge.points >= 0 ? '+' : ''}${badge.points} XP)`
                                      }
                                    >
                                      <span className="text-[10px] sm:text-xs">{badge.emoji}</span>
                                      <span className="font-mono text-amber-600 dark:text-amber-400">
                                        {badge.points >= 0 ? `+${badge.points}` : badge.points}
                                      </span>
                                      {canEditThisMember && (
                                        <X className="w-2.5 h-2.5 text-rose-500 opacity-60 hover:opacity-100 ml-0.5 shrink-0" />
                                      )}
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

      {/* Audit Log / Submissions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 rounded-2xl space-y-3 sm:space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FileImage className="w-4 h-4 text-indigo-500 shrink-0" /> Screenshot Verification Audit Logs
          </h3>
          <span className="text-[10px] sm:text-xs text-slate-500 font-semibold">{submissions.length} Uploaded Logs</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading audit log entries...</div>
        ) : submissions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No study screenshots uploaded yet for this challenge.
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3 max-h-80 overflow-y-auto pr-1">
            {submissions.map((sub) => {
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
                        <span className={m.pointsEarned >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                          {m.pointsEarned >= 0 ? `+${m.pointsEarned}` : m.pointsEarned} XP
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
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
    </div>
  );
}
