import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, AlertCircle, CheckCircle2, Shield, UserCheck, UserX, Loader2, Plus, Lock, Trophy, ChevronLeft, ChevronRight, Calendar, Zap, RefreshCw, Building2 } from 'lucide-react';
import { YptChallenge, YptExtractedMemberData, YptRuleConfig } from '../../../types/yptTypes';
import { addYptSubmissionLog, evaluatePointRule, fetchYptRoster, linkYptRosterToAppUsers, fetchYptGroups } from '../../../services/yptService';
import { useAuthCtx } from '../../../context/AppContext';
import { formatStudyDuration, getLocalYmd, getChallengeStartDateYmd, getChallengeEndDateYmd, getMemberStudyHoursFromApi } from '../../../utils/yptUtils';

interface YptSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenges: YptChallenge[];
  onSuccess: () => void;
  initialChallengeId?: string;
  initialDateYmd?: string;
}

export function YptSyncModal({
  isOpen,
  onClose,
  challenges,
  onSuccess,
  initialChallengeId,
  initialDateYmd,
}: YptSyncModalProps) {
  const { user } = useAuthCtx();

  // Filter available challenges (active and non-deleted)
  const availableChallenges = React.useMemo(() => {
    const todayStr = getLocalYmd(new Date());
    return challenges.filter((c) => {
      if (initialChallengeId && c.id === initialChallengeId) return true;
      if (c.isDeleted || c.status === 'deleted' || c.status === 'completed') return false;
      const endYmd = getChallengeEndDateYmd(c);
      return todayStr <= endYmd;
    });
  }, [challenges, initialChallengeId]);

  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    initialChallengeId || availableChallenges[0]?.id || ''
  );
  const [selectedDateYmd, setSelectedDateYmd] = useState<string>(
    initialDateYmd || getLocalYmd(new Date())
  );

  useEffect(() => {
    if (initialChallengeId) {
      setSelectedChallengeId(initialChallengeId);
    } else if (availableChallenges.length > 0 && (!selectedChallengeId || !availableChallenges.some((c) => c.id === selectedChallengeId))) {
      setSelectedChallengeId(availableChallenges[0].id);
    }
  }, [initialChallengeId, availableChallenges, isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (initialDateYmd) {
        setSelectedDateYmd(initialDateYmd);
      } else {
        setSelectedDateYmd(getLocalYmd(new Date()));
      }
      // Auto-fetch fresh live YPT roster on modal open
      if (selectedChallengeId) {
        handleFetchLiveYptData();
      }
    } else {
      setExtractedData(null);
      setError('');
    }
  }, [isOpen, selectedChallengeId]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [extractedData, setExtractedData] = useState<YptExtractedMemberData[] | null>(null);

  const currentChallenge = challenges.find((c) => c.id === selectedChallengeId);

  const PRESET_EMOJIS = ['☀️', '🌻', '📱', '🔟', '🔥', '🎯', '⏰', '🏆', '⚡', '🏞️', '📑'];

  // Recalculates points based on challenge rules
  const recalculateMemberPoints = (
    member: YptExtractedMemberData,
    newDetectedEmojis: string[],
    newMorningSnap: boolean,
    completedChallengeIds: number[] = []
  ): YptExtractedMemberData => {
    const rules = currentChallenge?.rules || {
      pointsPerStudyHour: 2,
      morningSnapBonus: 5,
      noStudyPenaltyThresholdHours: 3,
      penaltyPoints: 5,
    };

    let baseIntervalInHours = 1;
    if (rules.studyIntervalValue && rules.studyIntervalValue > 0) {
      baseIntervalInHours = rules.studyIntervalUnit === 'minutes'
        ? rules.studyIntervalValue / 60
        : rules.studyIntervalValue;
    }
    const intervalsCompleted = baseIntervalInHours > 0 ? Math.floor(member.hoursStudied / baseIntervalInHours) : Math.floor(member.hoursStudied);
    const ptsPerInt = typeof rules.pointsPerInterval === 'number'
      ? rules.pointsPerInterval
      : (rules.pointsPerStudyHour ?? 2);
    let points = intervalsCompleted * ptsPerInt;

    let penThreshHours = rules.noStudyPenaltyThresholdHours || 0;
    if (rules.penaltyThresholdValue && rules.penaltyThresholdValue > 0) {
      penThreshHours = rules.penaltyThresholdUnit === 'minutes'
        ? rules.penaltyThresholdValue / 60
        : rules.penaltyThresholdValue;
    }
    if (penThreshHours > 0 && member.hoursStudied < penThreshHours) {
      points -= (rules.penaltyPoints || 5);
    }

    const detectedRules: Array<{ ruleId?: string; ruleName: string; emoji: string; points: number }> = [];

    if (Array.isArray(rules.customRules)) {
      for (const cr of rules.customRules) {
        if (!cr || !cr.name) continue;
        const p = Number(cr.points) || 0;

        if (evaluatePointRule(cr, newDetectedEmojis, member.hoursStudied, newMorningSnap, completedChallengeIds)) {
          if (cr.type === 'bonus') {
            points += p;
          } else if (cr.type === 'penalty') {
            points -= p;
          }

          detectedRules.push({
            ruleId: cr.id,
            ruleName: cr.name,
            emoji: cr.emoji || '✨',
            points: cr.type === 'bonus' ? p : -p,
          });
        }
      }
    }

    return {
      ...member,
      morningSnap: newMorningSnap,
      detectedEmojis: newDetectedEmojis,
      detectedRules: detectedRules,
      pointsEarned: points,
    };
  };

  // 1-Click Fetch Live YPT Data Trigger
  const handleFetchLiveYptData = async () => {
    if (!currentChallenge) {
      setError('Please select an active YPT challenge.');
      return;
    }

    setIsSyncing(true);
    setError('');

    try {
      const legacyGids = [
        ...(currentChallenge.targetGroupIds || []),
        ...((currentChallenge as any).groupIds || []),
        ...((currentChallenge as any).yptGroupId ? [(currentChallenge as any).yptGroupId] : []),
        ...(((currentChallenge as any).groups || []).map((g: any) => g.id || g.gid || g)),
      ]
        .map(Number)
        .filter((id) => !isNaN(id) && id > 0);

      let targetGids = Array.from(new Set(legacyGids));
      if (targetGids.length === 0) {
        // Fallback to all joined groups
        const { groups } = await fetchYptGroups();
        targetGids = groups.map((g) => g.id);
      }

      const { roster } = await fetchYptRoster(targetGids);
      if (roster.length === 0) {
        setError('No members found in target YPT group roster.');
        setIsSyncing(false);
        return;
      }

      // Link live YPT members to Firestore registered App Users
      const linkedRoster = await linkYptRosterToAppUsers(roster);

      // Convert study duration using getMemberStudyHoursFromApi (handles ms & active live timer) and evaluate rules
      const extracted: YptExtractedMemberData[] = linkedRoster.map(({ yptMember, appUserId }) => {
        const hoursStudied = getMemberStudyHoursFromApi(yptMember);
        const initialEmojis: string[] = [];
        if (hoursStudied >= 10) initialEmojis.push('🔟');
        if (hoursStudied >= 5) initialEmojis.push('⚡');

        const completedChallengeIds: number[] = [];
        if (yptMember.cls && typeof yptMember.cls === 'object') {
          Object.entries(yptMember.cls).forEach(([nativeChId, c]: [string, any]) => {
            if (c && (c.st === 1 || c.status === 1 || c.st === true)) {
              if (nativeChId) completedChallengeIds.push(Number(nativeChId));
              if (c.id) completedChallengeIds.push(Number(c.id));
            }
          });
        }

        const baseMember: YptExtractedMemberData = {
          yptHandle: yptMember.n,
          matchedUid: appUserId,
          hoursStudied: parseFloat(hoursStudied.toFixed(2)),
          isStudyingCurrently: Boolean(yptMember.dl?.is),
          maxContinuousMs: yptMember.dl?.mm || 0,
          pointsEarned: 0,
          detectedEmojis: initialEmojis,
          detectedRules: [],
          morningSnap: false,
        };

        return recalculateMemberPoints(baseMember, initialEmojis, false, completedChallengeIds);
      });

      setExtractedData(extracted);
    } catch (err: any) {
      console.error('Failed to fetch live YPT data:', err);
      setError(err.message || 'Failed to fetch live YPT data. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleEmojiForMember = (memberIdx: number, emojiToToggle: string) => {
    if (!extractedData) return;
    const member = extractedData[memberIdx];
    if (!member) return;

    const currentEmojis = Array.isArray(member.detectedEmojis) ? [...member.detectedEmojis] : [];
    let updatedEmojis: string[];

    if (currentEmojis.some((e) => e.includes(emojiToToggle) || emojiToToggle.includes(e))) {
      updatedEmojis = currentEmojis.filter((e) => !e.includes(emojiToToggle) && !emojiToToggle.includes(e));
    } else {
      updatedEmojis = [...currentEmojis, emojiToToggle];
    }

    const isMorningSnapEmoji = emojiToToggle === '☀️';
    const updatedSnap = isMorningSnapEmoji
      ? updatedEmojis.includes('☀️')
      : member.morningSnap;

    const updatedMember = recalculateMemberPoints(member, updatedEmojis, updatedSnap);

    setExtractedData((prev) => {
      if (!prev) return null;
      const next = [...prev];
      next[memberIdx] = updatedMember;
      return next;
    });
  };

  // Date Navigation Helpers
  const minAllowedDateYmd = getChallengeStartDateYmd(currentChallenge);
  const maxAllowedDateYmd = getChallengeEndDateYmd(currentChallenge);
  const todayYmd = getLocalYmd(new Date());
  const upperLimitDateYmd = maxAllowedDateYmd < todayYmd ? maxAllowedDateYmd : todayYmd;

  const isPrevDisabled = selectedDateYmd <= minAllowedDateYmd;
  const isNextDisabled = selectedDateYmd >= upperLimitDateYmd;

  const handlePrevDate = () => {
    if (!isPrevDisabled) {
      const [y, m, d] = selectedDateYmd.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      dateObj.setDate(dateObj.getDate() - 1);
      const nextYmd = getLocalYmd(dateObj);
      if (nextYmd >= minAllowedDateYmd) setSelectedDateYmd(nextYmd);
    }
  };

  const handleNextDate = () => {
    if (!isNextDisabled) {
      const [y, m, d] = selectedDateYmd.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      dateObj.setDate(dateObj.getDate() + 1);
      const nextYmd = getLocalYmd(dateObj);
      if (nextYmd <= upperLimitDateYmd) setSelectedDateYmd(nextYmd);
    }
  };

  const handleConfirmSave = async () => {
    if (!extractedData || extractedData.length === 0) return;
    if (!user) {
      setError('You must be signed in to submit logs.');
      return;
    }
    if (!selectedChallengeId) {
      setError('Please select a challenge.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const totalPoints = extractedData.reduce((acc, curr) => acc + curr.pointsEarned, 0);

      await addYptSubmissionLog(selectedChallengeId, {
        challengeId: selectedChallengeId,
        uploaderUid: user.uid,
        imageUrl: '',
        extractedMembers: extractedData,
        totalPointsAwarded: totalPoints,
        dateYmd: selectedDateYmd,
        status: 'verified',
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving YPT live sync:', err);
      setError(err.message || 'Failed to save live study log.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
      {/* Backdrop overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      {/* Modal panel body */}
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#0F0F16] border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl text-slate-800 dark:text-slate-100 max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col min-h-0 z-10 my-auto">
        {/* Top Banner Header */}
        <div className="relative p-3.5 sm:p-5 bg-gradient-to-b from-indigo-50/80 via-indigo-50/20 to-transparent dark:from-indigo-950/40 dark:via-indigo-950/10 dark:to-transparent border-b border-slate-100 dark:border-slate-800/80 shrink-0 select-none">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest rounded-full flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>1-CLICK LIVE API SYNC</span>
            </span>

            <button
              onClick={onClose}
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Fetch Live YPT Study Logs
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Direct 1-second server sync. No screenshot uploading or OCR needed!
          </p>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Challenge & Date Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Target Challenge
              </label>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-2">
                <Trophy className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {currentChallenge?.title || 'Selected Challenge'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Target Date
              </label>
              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl select-none">
                <button
                  type="button"
                  onClick={handlePrevDate}
                  disabled={isPrevDisabled}
                  className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30 shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{selectedDateYmd}</span>
                </div>
                <button
                  type="button"
                  onClick={handleNextDate}
                  disabled={isNextDisabled}
                  className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30 shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 1-Click Fetch Live Button */}
          <div className="p-5 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-2xl text-center space-y-3">
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" /> Direct YPT Server Sync
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Retrieves exact study milliseconds directly from YPT servers for all roster members in ~1 second.
              </p>
            </div>

            <button
              type="button"
              onClick={handleFetchLiveYptData}
              disabled={isSyncing}
              className="px-6 py-3 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 mx-auto disabled:opacity-50 cursor-pointer"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Fetching Live YPT Milliseconds...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>⚡ Fetch Live YPT Data</span>
                </>
              )}
            </button>
          </div>

          {/* Live Extracted Members Table */}
          {extractedData && extractedData.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-100/90 dark:bg-slate-800/90 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 grid grid-cols-12 gap-2 items-center border-b border-slate-200 dark:border-slate-800">
                <span className="col-span-3">YPT Member</span>
                <span className="col-span-2 text-center">Live Duration</span>
                <span className="col-span-5 text-center">Badges & Rule Multipliers</span>
                <span className="col-span-2 text-right">Points Earned</span>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-72 overflow-y-auto">
                {extractedData.map((m, idx) => {
                  const rules = currentChallenge?.rules;
                  const customRules = rules?.customRules && rules.customRules.length > 0
                    ? rules.customRules
                    : [
                        {
                          id: 'default_snap',
                          name: 'Morning Snap',
                          emoji: '☀️',
                          points: rules?.morningSnapBonus || 5,
                          type: 'bonus' as const,
                        },
                      ];

                  const memberEmojis = Array.isArray(m.detectedEmojis) ? m.detectedEmojis : [];

                  return (
                    <div key={idx} className="p-3.5 text-xs grid grid-cols-12 gap-2 items-center bg-white dark:bg-slate-900/90 hover:bg-slate-50/80 dark:hover:bg-slate-900 transition-colors">
                      {/* Member Handle */}
                      <div className="col-span-3 flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 font-bold dark:text-slate-100 truncate">
                          {m.matchedUid ? (
                            <span className="text-emerald-500 flex items-center gap-1 shrink-0" title="Matched App User">
                              <UserCheck className="w-3.5 h-3.5 shrink-0" />
                            </span>
                          ) : (
                            <span className="text-slate-400 flex items-center gap-1 shrink-0" title="Unmatched YPT Handle">
                              <UserX className="w-3.5 h-3.5 shrink-0" />
                            </span>
                          )}
                          <span className="truncate">{m.yptHandle}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                          {m.matchedUid ? 'Profile Linked' : 'Unmatched'}
                        </span>
                      </div>

                      {/* Duration */}
                      <div className="col-span-2 text-center font-bold text-slate-800 dark:text-slate-100 font-mono text-sm">
                        {formatStudyDuration(m.hoursStudied)}
                      </div>

                      {/* Badges / Rule Toggles */}
                      <div className="col-span-5 flex flex-wrap items-center justify-center gap-1.5">
                        {customRules.map((cr) => {
                          const crEmoji = cr.emoji || '☀️';
                          const isActive =
                            (crEmoji && memberEmojis.some((e) => e.includes(crEmoji) || crEmoji.includes(e))) ||
                            (m.morningSnap && (crEmoji === '☀️' || cr.name.toLowerCase().includes('snap')));

                          return (
                            <button
                              key={cr.id}
                              type="button"
                              onClick={() => handleToggleEmojiForMember(idx, crEmoji)}
                              className={`px-2 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer select-none ${
                                isActive
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 dark:bg-amber-500/25 shadow-xs scale-102'
                                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 border-slate-200 dark:border-slate-700/80 opacity-60 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                              title={`Toggle ${cr.name} (${cr.type === 'bonus' ? '+' : '-'}${cr.points} XP)`}
                            >
                              <span className="text-sm">{crEmoji}</span>
                              <span className="hidden sm:inline text-[10px] font-semibold">{cr.name}</span>
                              <span className="text-[10px] font-black">
                                {cr.type === 'bonus' ? '+' : '-'}{cr.points}
                              </span>
                            </button>
                          );
                        })}

                        {/* Extra preset emojis */}
                        <div className="relative group">
                          <button
                            type="button"
                            className="px-1.5 py-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-600 bg-indigo-500/10 border border-indigo-500/20 rounded-xl transition-all flex items-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" />
                            <span>More</span>
                          </button>
                          <div className="absolute right-0 bottom-full mb-1 hidden group-hover:flex items-center gap-1 p-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-20">
                            {PRESET_EMOJIS.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => handleToggleEmojiForMember(idx, e)}
                                className="w-6 h-6 flex items-center justify-center text-xs rounded-lg hover:bg-slate-800 transition-colors"
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Points Earned */}
                      <div className="col-span-2 text-right flex flex-col items-end justify-center gap-0.5">
                        <div className={`font-black text-sm ${m.pointsEarned >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {m.pointsEarned >= 0 ? `+${m.pointsEarned}` : m.pointsEarned} XP
                        </div>
                        {Array.isArray(m.detectedRules) && m.detectedRules.length > 0 && (
                          <div className="text-[11px] text-slate-400 font-medium">
                            {m.detectedRules.map((r) => r.emoji).join(' ')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-end gap-3 p-4 sm:px-6 bg-slate-50 dark:bg-[#0B0B11] border-t border-slate-200 dark:border-slate-800/80 shrink-0 z-20">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>

          {extractedData && (
            <button
              type="button"
              onClick={handleConfirmSave}
              disabled={isSaving}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Live Sync...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Update Leaderboard</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
