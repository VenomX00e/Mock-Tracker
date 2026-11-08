import {
  YptChallenge,
  YptDailyDaySnapshot,
  YptApiMember,
  YptTeam,
  YptTeamMemberRef,
} from '../../../../types/yptTypes';
import {
  getYptDayYmd,
  areYptHandlesMatching,
  getChallengeStartDateYmd,
  getMemberStudyHoursFromApi,
  evaluateMemberDailyPoints,
} from '../../../../utils/yptUtils';
import { CalculatedParticipant } from '../YptIndividualStandings';

export interface CalculatedTeamMember {
  handleRaw: string;
  cleanHandle: string;
  periodPoints: number;
  periodHours: number;
  cumulativePoints: number;
  cumulativeHours: number;
  periodBadges: Array<{
    emoji: string;
    name: string;
    points: number;
    count: number;
    isTeamAll?: boolean;
  }>;
  isLiveFromApi: boolean;
  isStudyingCurrently: boolean;
}

export interface CalculatedTeam extends YptTeam {
  totalPoints: number;
  teamPeriodGain: number;
  teamPeriodHours: number;
  calculatedMembers: CalculatedTeamMember[];
  teamMvpHandle: string | null;
  teamSilverHandle: string | null;
}

export function calculateChallengeArenaStandings({
  challenge,
  dailySnapshots,
  liveRosterMembers,
  dateFilter,
  selectedFilterDateYmd,
  isSoloMode,
}: {
  challenge: YptChallenge;
  dailySnapshots: YptDailyDaySnapshot[];
  liveRosterMembers: YptApiMember[];
  dateFilter: 'date' | 'allTime';
  selectedFilterDateYmd: string;
  isSoloMode: boolean;
}) {
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

  // All past daily snapshots (< todayYmd)
  const pastSnapshots = dailySnapshots.filter((s) => (s.targetDateYmd || s.dateYmd) < todayYmd);
  const activeSnapshot = dailySnapshots.find((s) => (s.targetDateYmd || s.dateYmd) === selectedFilterDateYmd);
  const todaySnapshot = dailySnapshots.find((s) => (s.targetDateYmd || s.dateYmd) === todayYmd);

  // Global top scorer candidate for period
  let globalTopScorerHandle: string | null = null;
  let globalTopScorerPoints = -Infinity;

  // Helper to calculate statistics for a single participant/member across dailySnapshots & live streams
  const calculateMemberStats = (handleRaw: string, targetUd?: number): CalculatedTeamMember => {
    const cleanHandle = handleRaw.replace(/^@/, '').trim().toLowerCase();

    let periodHours = 0;
    let periodPoints = 0;
    let cumulativeHours = 0;
    let cumulativePoints = 0;

    const periodBadgeMap = new Map<string, { emoji: string; name: string; points: number; count: number; isTeamAll?: boolean }>();

    // 1. Add historical hours and points from all past snapshots
    pastSnapshots.forEach((snap) => {
      const rec = (snap.memberRecords || []).find((r) =>
        areYptHandlesMatching(r.yptHandle, handleRaw, r.userId, targetUd ? String(targetUd) : undefined)
      );
      let memberSnap = snap.memberSnapshots?.[cleanHandle];
      if (!memberSnap && snap.memberSnapshots) {
        const matchKey = Object.keys(snap.memberSnapshots).find((k) =>
          areYptHandlesMatching(snap.memberSnapshots[k].handle, handleRaw)
        );
        if (matchKey) memberSnap = snap.memberSnapshots[matchKey];
      }

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

    // 2. Compute Today's live / snapshot gain
    let todayLiveHours = 0;
    let todayLivePoints = 0;

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

    // Principle B & C: High-Water Mark & Snapshot Badges for Today
    if (todaySnapshot) {
      const snapRec = (todaySnapshot.memberRecords || []).find((r: any) =>
        areYptHandlesMatching(r.yptHandle, handleRaw, r.userId, targetUd ? String(targetUd) : undefined)
      );
      let memberSnap = todaySnapshot.memberSnapshots?.[cleanHandle];
      if (!memberSnap && todaySnapshot.memberSnapshots) {
        const matchKey = Object.keys(todaySnapshot.memberSnapshots).find((k) =>
          areYptHandlesMatching(todaySnapshot.memberSnapshots[k].handle, handleRaw)
        );
        if (matchKey) memberSnap = todaySnapshot.memberSnapshots[matchKey];
      }

      const recordedHwm = todaySnapshot.highWaterMarks?.[cleanHandle] ?? memberSnap?.hoursStudied ?? snapRec?.hoursStudied ?? 0;
      const recordedMaxContHwm = todaySnapshot.maxContinuousHighWaterMarks?.[cleanHandle] ?? memberSnap?.maxContinuousMs ?? 0;
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

      const snapNetPoints = memberSnap ? memberSnap.netPoints : (snapRec ? snapRec.netPoints : 0);
      const snapRules = memberSnap?.appliedRuleBreakdown || snapRec?.appliedRules || [];

      if (snapNetPoints > todayLivePoints || (recordedHwm >= apiLiveHours && (memberSnap || snapRec))) {
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

    // 3. Client Historical Date Navigator & State Rendering
    if (dateFilter === 'date') {
      if (selectedFilterDateYmd < todayYmd) {
        if (activeSnapshot) {
          const snapRec = (activeSnapshot.memberRecords || []).find((r) =>
            areYptHandlesMatching(r.yptHandle, handleRaw, r.userId, targetUd ? String(targetUd) : undefined)
          );
          let memberSnap = activeSnapshot.memberSnapshots?.[cleanHandle];
          if (!memberSnap && activeSnapshot.memberSnapshots) {
            const matchKey = Object.keys(activeSnapshot.memberSnapshots).find((k) =>
              areYptHandlesMatching(activeSnapshot.memberSnapshots[k].handle, handleRaw)
            );
            if (matchKey) memberSnap = activeSnapshot.memberSnapshots[matchKey];
          }

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
          } else {
            periodHours = 0;
            periodPoints = 0;
            periodBadgeMap.clear();
          }
        } else {
          periodHours = 0;
          periodPoints = 0;
          periodBadgeMap.clear();
        }
      } else if (selectedFilterDateYmd === todayYmd) {
        periodHours = todayLiveHours;
        periodPoints = todayLivePoints;
      } else {
        periodHours = 0;
        periodPoints = 0;
        periodBadgeMap.clear();
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
      if (isLiveDay && (badge.name?.toLowerCase().includes('no-study penalty') || (badge as any).ruleId === 'no_study_penalty')) {
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
  const processedTeams: CalculatedTeam[] = (challenge.teams || []).map((team) => {
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

    const teamMvpHandle =
      calculatedMembers.length > 0 && (calculatedMembers[0].cumulativePoints > 0 || calculatedMembers[0].cumulativeHours > 0)
        ? calculatedMembers[0].handleRaw
        : null;

    const teamSilverHandle =
      calculatedMembers.length > 1 && (calculatedMembers[1].cumulativePoints > 0 || calculatedMembers[1].cumulativeHours > 0)
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
    ? Array.isArray(challenge.participants) && challenge.participants.length > 0
      ? challenge.participants
      : (challenge.teams || []).flatMap((t) =>
          (t.memberUids || []).map((h) => ({
            yptUd: 0,
            yptHandle: h,
          }))
        )
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

  return {
    todayYmd,
    filterPeriodLabel,
    filterTitleLabel,
    globalTopScorerHandle,
    processedParticipants,
    activeTotalPointsAllTeams,
    rankedTeams,
  };
}
