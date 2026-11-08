import cron from "node-cron";
import admin from "firebase-admin";

import {
  initFirebaseAdmin,
  getAdminDb as getUnifiedAdminDb,
} from "./firebase-admin-init.js";
import {
  getYptDayYmdNode,
  getYesterdayYptDayYmdNode,
  getChallengeEndDateYmdNode,
  fetchFirestoreRestDoc,
  fetchFirestoreRestCollection,
  setFirestoreRestDoc,
  updateFirestoreRestDoc,
  areHandlesMatchingNode,
  fetchYptRosterForChallengeNode,
  calculatePointsFromRulesNode,
} from "./server/utils/backendHelpers.js";

const { db: initializedDb } = initFirebaseAdmin();
const db = initializedDb;

// Helper to calculate mock leaderboard stats safely
function calculateUserStats(mocks: any[]) {
  let sumP = 0;
  let pCount = 0;

  mocks.forEach((m) => {
    if (
      (!m.examScope || m.examScope === "Full") &&
      m.percentile != null &&
      !isNaN(m.percentile) &&
      m.percentile > 0
    ) {
      sumP += m.percentile;
      pCount++;
    }
  });

  return {
    avgPercentile: pCount > 0 ? Number((sumP / pCount).toFixed(2)) : 0,
    totalTests: mocks.length,
  };
}

export interface YptSyncDiagnosticResult {
  challengeId: string;
  challengeName: string;
  yptGroupId: number | string | null;
  participantsFound: number;
  participantsUpdated: number;
}

export interface YptSyncDiagnosticReport {
  success: boolean;
  timestamp: string;
  executionTimeMs: number;
  results: YptSyncDiagnosticResult[];
  errors: string[];
}

function isFirestorePermissionError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err);
  return (
    err.code === 7 ||
    err.code === 16 ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("ADC") ||
    msg.includes("UNAUTHENTICATED")
  );
}

function extractChallengeGroupIds(challenge: any): {
  groupIds: (string | number)[];
  resolvedYptGroupId: number | string | null;
} {
  const groupIds = (challenge.groups || [])
    .map((g: any) => g.id || g.gid || g)
    .concat(challenge.yptGroupId ? [challenge.yptGroupId] : [])
    .concat(challenge.groupIds || [])
    .concat(challenge.targetGroupIds || []);

  const rawGroupId =
    challenge.yptGroupId ||
    challenge.groups?.[0]?.id ||
    challenge.groups?.[0]?.gid ||
    challenge.groupIds?.[0] ||
    challenge.targetGroupIds?.[0] ||
    (groupIds.length > 0 ? groupIds[0] : null);

  const resolvedYptGroupId = rawGroupId
    ? !isNaN(Number(rawGroupId))
      ? Number(rawGroupId)
      : rawGroupId
    : null;

  return { groupIds, resolvedYptGroupId };
}

interface StoredMemoryBankState {
  existingHwms: Record<string, number>;
  existingMaxContHwms: Record<string, number>;
  challengeDailyHwms: Record<string, number>;
  challengeDailyMaxContHwms: Record<string, number>;
  challengeDailyCompletedChallenges: Record<string, number[]>;
  isAlreadyLocked: boolean;
}

function extractStoredMemoryBank(
  freshChallengeData: any,
  existingSnapData: any,
  targetYmd: string,
  checkStaleCrossBoundary: boolean
): StoredMemoryBankState {
  let existingHwms: Record<string, number> = {};
  let existingMaxContHwms: Record<string, number> = {};
  let challengeDailyHwms: Record<string, number> = {};
  let challengeDailyMaxContHwms: Record<string, number> = {};
  let challengeDailyCompletedChallenges: Record<string, number[]> = {};

  if (freshChallengeData) {
    const isStaleCrossBoundaryData =
      checkStaleCrossBoundary &&
      freshChallengeData?.lastDailySnapshotDate &&
      freshChallengeData.lastDailySnapshotDate < targetYmd;

    if (!isStaleCrossBoundaryData) {
      if (
        freshChallengeData.dailyHighWaterMarks &&
        typeof freshChallengeData.dailyHighWaterMarks === "object"
      ) {
        challengeDailyHwms = { ...freshChallengeData.dailyHighWaterMarks };
      }
      if (
        freshChallengeData.dailyMaxContinuousHighWaterMarks &&
        typeof freshChallengeData.dailyMaxContinuousHighWaterMarks === "object"
      ) {
        challengeDailyMaxContHwms = {
          ...freshChallengeData.dailyMaxContinuousHighWaterMarks,
        };
      }
      if (
        freshChallengeData.dailyCompletedChallenges &&
        typeof freshChallengeData.dailyCompletedChallenges === "object"
      ) {
        challengeDailyCompletedChallenges = {
          ...freshChallengeData.dailyCompletedChallenges,
        };
      }
    }
  }

  let isAlreadyLocked = false;
  if (existingSnapData) {
    if (existingSnapData.isLocked) {
      isAlreadyLocked = true;
    }
    if (existingSnapData.highWaterMarks) {
      existingHwms = { ...existingSnapData.highWaterMarks };
    }
    if (existingSnapData.maxContinuousHighWaterMarks) {
      existingMaxContHwms = { ...existingSnapData.maxContinuousHighWaterMarks };
    }
    if (existingSnapData.memberSnapshots) {
      for (const [h, m] of Object.entries(existingSnapData.memberSnapshots)) {
        existingHwms[h] = Math.max(
          existingHwms[h] || 0,
          (m as any).hoursStudied || 0
        );
        existingMaxContHwms[h] = Math.max(
          existingMaxContHwms[h] || 0,
          (m as any).maxContinuousMs || 0
        );
        if (
          Array.isArray((m as any).completedNativeChallengeIds) &&
          (m as any).completedNativeChallengeIds.length > 0
        ) {
          const prev = challengeDailyCompletedChallenges[h] || [];
          challengeDailyCompletedChallenges[h] = Array.from(
            new Set([...prev, ...(m as any).completedNativeChallengeIds])
          );
        }
      }
    }
  }

  return {
    existingHwms,
    existingMaxContHwms,
    challengeDailyHwms,
    challengeDailyMaxContHwms,
    challengeDailyCompletedChallenges,
    isAlreadyLocked,
  };
}

/**
 * Single Unified Member Processor used across Solo Mode & Team Mode,
 * and across both 15-Minute Live Sync (isFinalizerLock = false) and 5:15 AM Finalizer (isFinalizerLock = true).
 */
function evaluateMemberForCronSnapshot(
  memberSpec: { yptUd?: number; yptHandle: string },
  liveMembers: any[],
  challenge: any,
  memoryState: {
    existingHwms: Record<string, number>;
    existingMaxContHwms: Record<string, number>;
    challengeDailyHwms: Record<string, number>;
    challengeDailyMaxContHwms: Record<string, number>;
    challengeDailyCompletedChallenges: Record<string, number[]>;
    updatedHwms: Record<string, number>;
    updatedMaxContHwms: Record<string, number>;
    updatedChallengeHwms: Record<string, number>;
    updatedChallengeMaxContHwms: Record<string, number>;
    updatedChallengeCompletedChallenges: Record<string, number[]>;
  },
  isFinalizerLock: boolean
) {
  const cleanHandle = (memberSpec.yptHandle || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  const memberUdStr = memberSpec.yptUd ? String(memberSpec.yptUd) : "";
  if (!cleanHandle && !memberUdStr) return null;

  const liveMember = liveMembers.find((m: any) => {
    if (memberSpec.yptUd && m.ud && Number(m.ud) === Number(memberSpec.yptUd)) {
      return true;
    }
    if (memberUdStr && m.ud && String(m.ud) === memberUdStr) {
      return true;
    }
    return areHandlesMatchingNode(
      m.n || m.nickname,
      cleanHandle,
      String(m.ud || "")
    );
  });

  const resolvedUd = liveMember?.ud || memberSpec.yptUd || 0;
  const resolvedUdKey = resolvedUd ? String(resolvedUd) : cleanHandle;

  let apiLiveSm = 0;
  let apiLiveMaxContMs = 0;
  const completedChallengeIds: number[] = [];

  if (!isFinalizerLock && liveMember) {
    if (liveMember.dl && typeof liveMember.dl.sm === "number") {
      apiLiveSm = liveMember.dl.sm;
    } else if (typeof liveMember.sm === "number") {
      apiLiveSm = liveMember.sm;
    }

    if (liveMember.dl && typeof liveMember.dl.mm === "number") {
      apiLiveMaxContMs = liveMember.dl.mm;
    }

    if (liveMember.cls && typeof liveMember.cls === "object") {
      for (const [cIdStr, cItem] of Object.entries(liveMember.cls)) {
        const c = cItem as any;
        if (c && (c.st === 1 || c.status === 1 || c.st === true)) {
          const keyId = Number(cIdStr);
          if (!isNaN(keyId)) completedChallengeIds.push(keyId);
          if (c.id && !isNaN(Number(c.id))) {
            completedChallengeIds.push(Number(c.id));
          }
        }
      }
    }
  }

  const prevStoredCompleted =
    memoryState.challengeDailyCompletedChallenges[resolvedUdKey] ||
    memoryState.challengeDailyCompletedChallenges[cleanHandle] ||
    [];
  const finalCompletedList = Array.from(
    new Set<number>([...prevStoredCompleted, ...completedChallengeIds])
  );

  memoryState.updatedChallengeCompletedChallenges[resolvedUdKey] =
    finalCompletedList;
  if (cleanHandle && cleanHandle !== resolvedUdKey) {
    memoryState.updatedChallengeCompletedChallenges[cleanHandle] =
      finalCompletedList;
  }

  const hasCompletedActiveChallenge = challenge.nativeYptChallengeId
    ? finalCompletedList.includes(Number(challenge.nativeYptChallengeId))
    : finalCompletedList.length > 0;

  // High-Water Mark calculation (at 5:15 AM finalizer, apiLiveSm is 0 so prevStoredSm is preserved per 4:59 AM rule)
  const prevStoredSm =
    memoryState.challengeDailyHwms[resolvedUdKey] ||
    (memoryState.existingHwms[cleanHandle]
      ? Math.round(memoryState.existingHwms[cleanHandle] * 3600000)
      : 0);
  const peakSm = isFinalizerLock
    ? prevStoredSm
    : Math.max(prevStoredSm, apiLiveSm);
  memoryState.updatedChallengeHwms[resolvedUdKey] = peakSm;

  const prevMaxContStored =
    memoryState.challengeDailyMaxContHwms[resolvedUdKey] ||
    memoryState.existingMaxContHwms[cleanHandle] ||
    0;
  const peakMaxContMs = isFinalizerLock
    ? prevMaxContStored
    : Math.max(prevMaxContStored, apiLiveMaxContMs);
  memoryState.updatedChallengeMaxContHwms[resolvedUdKey] = peakMaxContMs;

  const peakHours = Math.round((peakSm / 3600000) * 100) / 100;
  memoryState.updatedHwms[cleanHandle] = peakHours;
  memoryState.updatedMaxContHwms[cleanHandle] = peakMaxContMs;

  const calculated = calculatePointsFromRulesNode(
    peakHours,
    challenge.rules,
    [],
    finalCompletedList,
    isFinalizerLock, // false during 15m live sync, true during 5:15 AM finalizer
    peakMaxContMs
  );

  const isCurrentlyStudying = isFinalizerLock
    ? false
    : Boolean(liveMember?.dl?.is);
  const displayHandle =
    liveMember?.n || memberSpec.yptHandle || cleanHandle;
  const nowIso = new Date().toISOString();

  const snapshotItem = {
    handle: displayHandle,
    nickname: displayHandle,
    rawYptUd: resolvedUd || undefined,
    yptUd: resolvedUd || undefined,
    hoursStudied: peakHours,
    studyMs: peakSm,
    maxContinuousMs: peakMaxContMs,
    isCurrentlyStudying,
    isStudying: isCurrentlyStudying,
    completedNativeChallengeIds: finalCompletedList,
    hasCompleted: hasCompletedActiveChallenge,
    basePoints: calculated.baseStudyPoints,
    bonusPoints: calculated.bonusPoints,
    penaltyPoints: isFinalizerLock ? calculated.penaltyPoints : 0,
    netPoints: calculated.netPoints,
    appliedRuleBreakdown: calculated.appliedRules,
    status: "active",
    lastSyncedAt: nowIso,
  };

  const memberRecord = {
    yptHandle: displayHandle,
    userId: resolvedUd ? String(resolvedUd) : undefined,
    hoursStudied: peakHours,
    basePoints: calculated.baseStudyPoints,
    bonusPoints: calculated.bonusPoints,
    penaltyPoints: isFinalizerLock ? calculated.penaltyPoints || 0 : 0,
    netPoints: calculated.netPoints,
    isCurrentlyStudying,
    appliedRules: calculated.appliedRules,
    completedChallengeIds: finalCompletedList,
  };

  const participantUpdate = {
    yptUd: Number(resolvedUd) || 0,
    yptHandle: displayHandle,
    hours: peakHours,
    studyMs: peakSm,
    isStudying: isCurrentlyStudying,
    hasCompleted: hasCompletedActiveChallenge,
    completedChallengeIds: finalCompletedList,
    lastSyncedAt: nowIso,
  };

  return {
    cleanHandle,
    resolvedUdKey,
    peakHours,
    netPoints: calculated.netPoints,
    snapshotItem,
    memberRecord,
    participantUpdate,
  };
}

/**
 * Builds the complete day snapshot & challenge update payload for a challenge.
 * Works identically for Solo Mode and Team Mode, and for 15-min sync vs 5:15 AM finalizer.
 */
function buildChallengeDaySnapshotAndUpdates(
  challenge: any,
  liveMembers: any[],
  targetYmd: string,
  storedBank: StoredMemoryBankState,
  isFinalizerLock: boolean
) {
  const mode = challenge.mode || "team";
  const isSoloMode = mode === "individual";

  const memoryState = {
    existingHwms: storedBank.existingHwms,
    existingMaxContHwms: storedBank.existingMaxContHwms,
    challengeDailyHwms: storedBank.challengeDailyHwms,
    challengeDailyMaxContHwms: storedBank.challengeDailyMaxContHwms,
    challengeDailyCompletedChallenges:
      storedBank.challengeDailyCompletedChallenges,
    updatedHwms: { ...storedBank.existingHwms },
    updatedMaxContHwms: { ...storedBank.existingMaxContHwms },
    updatedChallengeHwms: { ...storedBank.challengeDailyHwms },
    updatedChallengeMaxContHwms: { ...storedBank.challengeDailyMaxContHwms },
    updatedChallengeCompletedChallenges: {
      ...storedBank.challengeDailyCompletedChallenges,
    },
  };

  const memberSnapshots: Record<string, any> = {};
  const memberRecords: any[] = [];
  const updatedParticipants: any[] = [];
  const teamStandingsDraft: Array<{
    teamId: string;
    teamName: string;
    dayHours: number;
    dayPoints: number;
  }> = [];
  let participantStandings: Array<{
    yptUd?: number;
    yptHandle: string;
    dayHours: number;
    dayPoints: number;
    rank: number;
  }> = [];
  let dayTotalHours = 0;
  let dayTotalPoints = 0;
  let activeMemberCount = 0;

  if (isSoloMode) {
    const participantsList: Array<{ yptUd?: number; yptHandle: string }> =
      challenge.participants && challenge.participants.length > 0
        ? challenge.participants
        : liveMembers.map((m: any) => ({ yptUd: m.ud, yptHandle: m.n }));

    participantsList.forEach((p) => {
      const evaluated = evaluateMemberForCronSnapshot(
        p,
        liveMembers,
        challenge,
        memoryState,
        isFinalizerLock
      );
      if (!evaluated) return;

      if (evaluated.peakHours > 0) activeMemberCount++;
      dayTotalHours += evaluated.peakHours;
      dayTotalPoints += evaluated.netPoints;

      updatedParticipants.push(evaluated.participantUpdate);
      memberSnapshots[evaluated.cleanHandle] = evaluated.snapshotItem;
      if (
        evaluated.resolvedUdKey &&
        evaluated.resolvedUdKey !== evaluated.cleanHandle
      ) {
        memberSnapshots[evaluated.resolvedUdKey] = evaluated.snapshotItem;
      }
      memberRecords.push(evaluated.memberRecord);
    });

    const seenKeys = new Set<string>();
    const participantDraft = Object.values(memberSnapshots)
      .filter((m: any) => {
        const uKey = m.rawYptUd ? `ud_${m.rawYptUd}` : `h_${m.handle}`;
        if (seenKeys.has(uKey)) return false;
        seenKeys.add(uKey);
        return true;
      })
      .map((m: any) => ({
        yptUd: m.rawYptUd,
        yptHandle: m.handle,
        dayHours: m.hoursStudied,
        dayPoints: m.netPoints,
      }));
    participantDraft.sort(
      (a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours
    );
    participantStandings = participantDraft.map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));
  } else {
    (challenge.teams || []).forEach((team: any) => {
      let teamDailyHours = 0;
      let teamDailyPoints = 0;

      (team.memberUids || []).forEach((memberHandleOrUid: string) => {
        const isNumUid = !isNaN(Number(memberHandleOrUid));
        const evaluated = evaluateMemberForCronSnapshot(
          {
            yptUd: isNumUid ? Number(memberHandleOrUid) : undefined,
            yptHandle: memberHandleOrUid,
          },
          liveMembers,
          challenge,
          memoryState,
          isFinalizerLock
        );
        if (!evaluated) return;

        if (evaluated.peakHours > 0) activeMemberCount++;
        dayTotalHours += evaluated.peakHours;
        teamDailyHours += evaluated.peakHours;
        teamDailyPoints += evaluated.netPoints;

        updatedParticipants.push(evaluated.participantUpdate);
        memberSnapshots[evaluated.cleanHandle] = evaluated.snapshotItem;
        memberRecords.push(evaluated.memberRecord);
      });

      teamStandingsDraft.push({
        teamId: team.id,
        teamName: team.name || `Team ${team.id}`,
        dayHours: Math.round(teamDailyHours * 100) / 100,
        dayPoints: teamDailyPoints,
      });

      dayTotalPoints += teamDailyPoints;
    });
  }

  teamStandingsDraft.sort(
    (a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours
  );
  const teamStandings = teamStandingsDraft.map((t, idx) => ({
    ...t,
    rank: idx + 1,
  }));

  const roundedTotalHours = Math.round(dayTotalHours * 100) / 100;
  const nowIso = new Date().toISOString();

  const snapshotData: any = {
    id: targetYmd,
    challengeId: challenge.id,
    dateYmd: targetYmd,
    targetDateYmd: targetYmd,
    isLocked: isFinalizerLock,
    ...(isFinalizerLock
      ? {
          lockedAt: nowIso,
          lockedBy: "cron_system" as const,
          isAutoClosed: true,
          closedAt: Date.now(),
        }
      : {}),
    totalChallengeHours: roundedTotalHours,
    totalHoursStudied: roundedTotalHours,
    totalChallengePoints: dayTotalPoints,
    activeMemberCount,
    memberSnapshots,
    memberRecords,
    teamStandings: isSoloMode ? [] : teamStandings,
    participantStandings: isSoloMode ? participantStandings : undefined,
    highWaterMarks: memoryState.updatedHwms,
    maxContinuousHighWaterMarks: memoryState.updatedMaxContHwms,
    lastSyncedAt: nowIso,
  };

  const challengeUpdatePayload: any = {
    dailyHighWaterMarks: memoryState.updatedChallengeHwms,
    dailyMaxContinuousHighWaterMarks: memoryState.updatedChallengeMaxContHwms,
    dailyCompletedChallenges: memoryState.updatedChallengeCompletedChallenges,
    lastDailySnapshotDate: targetYmd,
    lastSyncedAt: nowIso,
  };

  if (updatedParticipants.length > 0) {
    challengeUpdatePayload.participants = updatedParticipants;
  }

  return {
    snapshotData,
    challengeUpdatePayload,
    updatedParticipants,
    participantStandings,
    teamStandings,
    isSoloMode,
  };
}

/**
 * Builds the fresh 0h unlocked snapshot for todayYmd during the 5:15 AM day transition.
 */
function buildFreshDaySnapshotData(
  challenge: any,
  liveMembers: any[],
  todayYmd: string
) {
  const isSoloMode = (challenge.mode || "team") === "individual";
  const initialMemberSnapshots: Record<string, any> = {};
  const initialTeamStandings: Array<{
    teamId: string;
    teamName: string;
    dayHours: number;
    dayPoints: number;
    rank: number;
  }> = [];
  let initialParticipantStandings: Array<{
    yptUd?: number;
    yptHandle: string;
    dayHours: number;
    dayPoints: number;
    rank: number;
  }> = [];
  const nowIso = new Date().toISOString();

  if (isSoloMode) {
    const participantsList: Array<{ yptUd?: number; yptHandle: string }> =
      challenge.participants && challenge.participants.length > 0
        ? challenge.participants
        : liveMembers.map((m: any) => ({ yptUd: m.ud, yptHandle: m.n }));

    initialParticipantStandings = participantsList.map((p, idx) => {
      const cleanHandle = (p.yptHandle || "")
        .replace(/^@/, "")
        .trim()
        .toLowerCase();
      const resolvedUdKey = p.yptUd ? String(p.yptUd) : cleanHandle;
      const freshSnapshotItem = {
        handle: p.yptHandle || cleanHandle,
        nickname: p.yptHandle || cleanHandle,
        rawYptUd: p.yptUd,
        yptUd: p.yptUd,
        hoursStudied: 0,
        studyMs: 0,
        maxContinuousMs: 0,
        isCurrentlyStudying: false,
        completedNativeChallengeIds: [],
        basePoints: 0,
        bonusPoints: 0,
        penaltyPoints: 0,
        netPoints: 0,
        appliedRuleBreakdown: [],
        status: "active",
        lastSyncedAt: nowIso,
      };

      initialMemberSnapshots[cleanHandle] = freshSnapshotItem;
      if (resolvedUdKey && resolvedUdKey !== cleanHandle) {
        initialMemberSnapshots[resolvedUdKey] = freshSnapshotItem;
      }

      return {
        yptUd: p.yptUd,
        yptHandle: p.yptHandle || cleanHandle,
        dayHours: 0,
        dayPoints: 0,
        rank: idx + 1,
      };
    });
  } else {
    (challenge.teams || []).forEach((team: any, idx: number) => {
      (team.memberUids || []).forEach((mHandle: string) => {
        const cleanHandle = mHandle.replace(/^@/, "").trim().toLowerCase();
        initialMemberSnapshots[cleanHandle] = {
          handle: cleanHandle,
          hoursStudied: 0,
          studyMs: 0,
          maxContinuousMs: 0,
          isCurrentlyStudying: false,
          completedNativeChallengeIds: [],
          basePoints: 0,
          bonusPoints: 0,
          penaltyPoints: 0,
          netPoints: 0,
          appliedRuleBreakdown: [],
          status: "active",
          lastSyncedAt: nowIso,
        };
      });

      initialTeamStandings.push({
        teamId: team.id,
        teamName: team.name || `Team ${team.id}`,
        dayHours: 0,
        dayPoints: 0,
        rank: idx + 1,
      });
    });
  }

  return {
    id: todayYmd,
    challengeId: challenge.id,
    dateYmd: todayYmd,
    targetDateYmd: todayYmd,
    isLocked: false,
    totalChallengeHours: 0,
    totalChallengePoints: 0,
    activeMemberCount: 0,
    memberSnapshots: initialMemberSnapshots,
    memberRecords: [],
    teamStandings: isSoloMode ? [] : initialTeamStandings,
    participantStandings: isSoloMode ? initialParticipantStandings : undefined,
    highWaterMarks: {},
    maxContinuousHighWaterMarks: {},
    lastSyncedAt: nowIso,
  };
}

/**
 * Computes auto-completion winner fields from all daily snapshots when a challenge concludes.
 */
function buildAutoCompletedChallengeUpdate(
  challenge: any,
  allSnapDocsData: any[],
  yesterdayYmd: string,
  challengeEndDateYmd: string,
  fallbackParticipantStandings: any[]
) {
  const isSoloMode = (challenge.mode || "team") === "individual";
  const completionUpdate: any = {
    status: "completed",
    completedAt: new Date().toISOString(),
    completedBy: "cron_system",
    autoCompletedReason: `Reached end date ${challengeEndDateYmd} and finalized last day ${yesterdayYmd}.`,
  };

  if (allSnapDocsData.length === 0) {
    return completionUpdate;
  }

  if (isSoloMode) {
    const memberPointTotals: Record<
      string,
      { yptUd?: number; yptHandle: string; points: number; hours: number }
    > = {};
    allSnapDocsData.forEach((data) => {
      if (data.participantStandings && Array.isArray(data.participantStandings)) {
        data.participantStandings.forEach((ps: any) => {
          const key =
            (ps.yptHandle || "").replace(/^@/, "").trim().toLowerCase() ||
            String(ps.yptUd || "");
          if (!key) return;
          if (!memberPointTotals[key]) {
            memberPointTotals[key] = {
              yptUd: ps.yptUd,
              yptHandle: ps.yptHandle || key,
              points: 0,
              hours: 0,
            };
          }
          memberPointTotals[key].points += ps.dayPoints || 0;
          memberPointTotals[key].hours += ps.dayHours || 0;
        });
      } else if (data.memberSnapshots) {
        Object.values(data.memberSnapshots).forEach((ms: any) => {
          const key =
            (ms.handle || "").replace(/^@/, "").trim().toLowerCase() ||
            String(ms.rawYptUd || "");
          if (!key) return;
          if (!memberPointTotals[key]) {
            memberPointTotals[key] = {
              yptUd: ms.rawYptUd,
              yptHandle: ms.handle || key,
              points: 0,
              hours: 0,
            };
          }
          memberPointTotals[key].points += ms.netPoints || 0;
          memberPointTotals[key].hours += ms.hoursStudied || 0;
        });
      }
    });

    const sortedParticipants = Object.values(memberPointTotals).sort(
      (a, b) => b.points - a.points || b.hours - a.hours
    );
    const topWinner = sortedParticipants[0] || fallbackParticipantStandings[0];
    const sortedByHours = Object.values(memberPointTotals).sort(
      (a, b) => b.hours - a.hours
    );
    const topMvp = sortedByHours[0];

    completionUpdate.winningParticipantUd = topWinner?.yptUd || null;
    completionUpdate.winningParticipantHandle = topWinner?.yptHandle || null;
    completionUpdate.finalMvpHandle =
      topMvp?.yptHandle || topWinner?.yptHandle || null;
  } else {
    const teamPointTotals: Record<
      string,
      { teamId: string; teamName: string; points: number; hours: number }
    > = {};
    (challenge.teams || []).forEach((t: any) => {
      teamPointTotals[t.id] = {
        teamId: t.id,
        teamName: t.name,
        points: t.totalPoints || 0,
        hours: 0,
      };
    });

    const memberHoursMap: Record<string, number> = {};
    allSnapDocsData.forEach((data) => {
      if (data.teamStandings && Array.isArray(data.teamStandings)) {
        data.teamStandings.forEach((ts: any) => {
          if (ts.teamId && teamPointTotals[ts.teamId]) {
            teamPointTotals[ts.teamId].hours += ts.dayHours || 0;
          }
        });
      }
      if (data.memberSnapshots) {
        Object.values(data.memberSnapshots).forEach((ms: any) => {
          const clean = (ms.handle || "")
            .replace(/^@/, "")
            .trim()
            .toLowerCase();
          memberHoursMap[clean] =
            (memberHoursMap[clean] || 0) + (ms.hoursStudied || 0);
        });
      }
    });

    const sortedTeams = Object.values(teamPointTotals).sort(
      (a, b) => b.points - a.points || b.hours - a.hours
    );
    const topTeam = sortedTeams[0];
    const sortedMembers = Object.entries(memberHoursMap).sort(
      (a, b) => b[1] - a[1]
    );
    const topMvp = sortedMembers[0];

    completionUpdate.winningTeamId = topTeam?.teamId || null;
    completionUpdate.finalMvpHandle = topMvp ? topMvp[0] : null;
  }

  return completionUpdate;
}

/**
 * Executes 15-Minute Continuous Sync via REST API fallback.
 */
async function executeContinuousYptSyncViaRest(): Promise<YptSyncDiagnosticReport> {
  const startTimeMs = Date.now();
  const results: YptSyncDiagnosticResult[] = [];
  const errors: string[] = [];
  const activeYmd = getYptDayYmdNode();
  console.log(
    `[YPT 15-MIN REST SYNC] Starting live sync for active date: ${activeYmd} via REST API fallback...`
  );

  try {
    const rawChallenges = await fetchFirestoreRestCollection("yptChallenges");
    const activeChallenges = rawChallenges
      .map((d) => ({ id: d.id, ...d.data } as any))
      .filter((c) => !c.isDeleted && c.status !== "completed");

    if (activeChallenges.length === 0) {
      return {
        success: true,
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTimeMs,
        results: [],
        errors: [],
      };
    }

    for (const challenge of activeChallenges) {
      try {
        const challengeEndDateYmd = getChallengeEndDateYmdNode(challenge);
        if (activeYmd > challengeEndDateYmd) continue;

        const { groupIds, resolvedYptGroupId } =
          extractChallengeGroupIds(challenge);
        const { members: liveMembers, errors: rosterErrors } =
          await fetchYptRosterForChallengeNode(groupIds);
        if (rosterErrors && rosterErrors.length > 0) {
          errors.push(...rosterErrors);
        }

        const [freshChallengeData, existingSnapData] = await Promise.all([
          fetchFirestoreRestDoc(`yptChallenges/${challenge.id}`),
          fetchFirestoreRestDoc(
            `yptChallenges/${challenge.id}/dailySnapshots/${activeYmd}`
          ),
        ]);

        const storedBank = extractStoredMemoryBank(
          freshChallengeData,
          existingSnapData,
          activeYmd,
          true
        );
        if (storedBank.isAlreadyLocked) continue;

        const {
          snapshotData,
          challengeUpdatePayload,
          updatedParticipants,
        } = buildChallengeDaySnapshotAndUpdates(
          challenge,
          liveMembers,
          activeYmd,
          storedBank,
          false
        );

        await setFirestoreRestDoc(
          `yptChallenges/${challenge.id}/dailySnapshots/${activeYmd}`,
          snapshotData
        );
        try {
          await setFirestoreRestDoc(
            `yptChallenges/${challenge.id}/daily_snapshots/daily_${activeYmd}`,
            snapshotData
          );
        } catch {}

        await updateFirestoreRestDoc(`yptChallenges/${challenge.id}`, {
          ...challengeUpdatePayload,
          lastCronSyncAt: new Date().toISOString(),
        });

        results.push({
          challengeId: challenge.id,
          challengeName:
            challenge.title || challenge.name || "Untitled Challenge",
          yptGroupId: resolvedYptGroupId,
          participantsFound: liveMembers.length,
          participantsUpdated: updatedParticipants.length,
        });

        console.log(
          `[YPT 15-MIN REST SYNC] Successfully synced challenge ${
            challenge.title || challenge.name || challenge.id
          } (${activeYmd}) via REST.`
        );
      } catch (chErr: any) {
        const errDesc = `Error in REST sync for challenge ${challenge.id}: ${
          chErr?.message || String(chErr)
        }`;
        console.error(`[YPT 15-MIN REST SYNC] ${errDesc}`, chErr);
        errors.push(errDesc);
      }
    }

    return {
      success: errors.length === 0,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTimeMs,
      results,
      errors,
    };
  } catch (err: any) {
    console.error("[YPT 15-MIN REST SYNC] Top-level REST sync error:", err);
    errors.push(err?.message || String(err));
    return {
      success: false,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTimeMs,
      results,
      errors,
    };
  }
}

/**
 * Regular 15-Minute Continuous Sync logic:
 * Updates the open snapshot with High-Water Mark peak hours and returns structured diagnostic logs.
 * Automatically falls back to Firestore REST API if Admin SDK encounters Error 7 (PERMISSION_DENIED).
 */
async function execute15MinYptSync(
  adminDb?: admin.firestore.Firestore
): Promise<YptSyncDiagnosticReport> {
  const targetDb = adminDb || getUnifiedAdminDb();
  if (!targetDb) {
    return await executeContinuousYptSyncViaRest();
  }

  const startTimeMs = Date.now();
  const results: YptSyncDiagnosticResult[] = [];
  const errors: string[] = [];

  try {
    const activeYmd = getYptDayYmdNode();
    console.log(
      `[YPT 15-MIN CRON] Starting live sync for active date: ${activeYmd}...`
    );

    const challengesSnap = await targetDb.collection("yptChallenges").get();
    const activeChallenges = challengesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter((c) => !c.isDeleted && c.status !== "completed");

    if (activeChallenges.length === 0) {
      return {
        success: true,
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTimeMs,
        results: [],
        errors: [],
      };
    }

    const writeBatch = targetDb.batch();
    let batchOperationCount = 0;

    for (const challenge of activeChallenges) {
      try {
        const challengeEndDateYmd = getChallengeEndDateYmdNode(challenge);
        if (activeYmd > challengeEndDateYmd) continue;

        const { groupIds, resolvedYptGroupId } =
          extractChallengeGroupIds(challenge);
        const { members: liveMembers, errors: rosterErrors } =
          await fetchYptRosterForChallengeNode(groupIds, targetDb);
        if (rosterErrors && rosterErrors.length > 0) {
          errors.push(...rosterErrors);
        }

        const challengeDocRef = targetDb
          .collection("yptChallenges")
          .doc(challenge.id);
        const snapDocRef = challengeDocRef
          .collection("dailySnapshots")
          .doc(activeYmd);

        const [freshChallengeDoc, existingSnap] = await Promise.all([
          challengeDocRef.get(),
          snapDocRef.get(),
        ]);

        const storedBank = extractStoredMemoryBank(
          freshChallengeDoc.exists ? freshChallengeDoc.data() : null,
          existingSnap.exists ? existingSnap.data() : null,
          activeYmd,
          true
        );
        if (storedBank.isAlreadyLocked) continue;

        const {
          snapshotData,
          challengeUpdatePayload,
          updatedParticipants,
        } = buildChallengeDaySnapshotAndUpdates(
          challenge,
          liveMembers,
          activeYmd,
          storedBank,
          false
        );

        writeBatch.set(snapDocRef, snapshotData, { merge: true });
        batchOperationCount++;

        try {
          const legacyRef = challengeDocRef
            .collection("daily_snapshots")
            .doc(`daily_${activeYmd}`);
          writeBatch.set(legacyRef, snapshotData, { merge: true });
          batchOperationCount++;
        } catch {}

        const adminChallengeUpdate = {
          ...challengeUpdatePayload,
          lastCronSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        writeBatch.update(challengeDocRef, adminChallengeUpdate);
        batchOperationCount++;

        try {
          const altChallengeRef = targetDb
            .collection("challenges")
            .doc(challenge.id);
          writeBatch.set(altChallengeRef, adminChallengeUpdate, {
            merge: true,
          });
          batchOperationCount++;
        } catch {}

        results.push({
          challengeId: challenge.id,
          challengeName:
            challenge.title || challenge.name || "Untitled Challenge",
          yptGroupId: resolvedYptGroupId,
          participantsFound: liveMembers.length,
          participantsUpdated: updatedParticipants.length,
        });

        console.log(
          `[YPT 15-MIN CRON] Staged snapshot & challenge doc updates for challenge: ${
            challenge.title || challenge.name || challenge.id
          } (${activeYmd}).`
        );
      } catch (chErr: any) {
        const errDesc = `Error processing challenge ${challenge.id} (${
          challenge.title || challenge.name
        }): ${chErr?.message || String(chErr)}`;
        console.error(`[YPT 15-MIN CRON] ${errDesc}`, chErr);
        errors.push(errDesc);
      }
    }

    if (batchOperationCount > 0) {
      try {
        await writeBatch.commit();
        console.log(
          `[YPT 15-MIN CRON] Phase 4 Batch Commit: Successfully committed ${batchOperationCount} write operations across ${activeChallenges.length} active challenge(s) simultaneously.`
        );
      } catch (commitErr: any) {
        if (isFirestorePermissionError(commitErr)) {
          console.warn(
            "[YPT 15-MIN CRON] Admin writeBatch.commit() encountered Error 7 (PERMISSION_DENIED). Synchronizing challenge states via authenticated Firestore REST API fallback..."
          );
          return await executeContinuousYptSyncViaRest();
        }
        throw commitErr;
      }
    }

    return {
      success: errors.length === 0,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTimeMs,
      results,
      errors,
    };
  } catch (err: any) {
    if (isFirestorePermissionError(err)) {
      console.warn(
        "[YPT 15-MIN CRON] Admin Firestore encountered PERMISSION_DENIED (Error 7). Delegating to authenticated Firestore REST API sync..."
      );
      return await executeContinuousYptSyncViaRest();
    }
    console.error(
      "[YPT 15-MIN CRON] Encountered unexpected error, attempting REST fallback:",
      err
    );
    try {
      return await executeContinuousYptSyncViaRest();
    } catch {
      errors.push(err?.message || String(err));
      return {
        success: false,
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTimeMs,
        results,
        errors,
      };
    }
  }
}

/**
 * Executes 5:15 AM IST Daily Finalizer via REST API fallback.
 */
async function execute515AmYptFinalizerViaRest(): Promise<void> {
  const yesterdayYmd = getYesterdayYptDayYmdNode();
  const todayYmd = getYptDayYmdNode();
  console.log(
    `[YPT 5:15 AM REST FINALIZER] Executing Day Transition via REST API fallback. Concluded: ${yesterdayYmd}, Fresh: ${todayYmd}...`
  );

  try {
    const rawChallenges = await fetchFirestoreRestCollection("yptChallenges");
    const activeChallenges = rawChallenges
      .map((d) => ({ id: d.id, ...d.data } as any))
      .filter((c) => !c.isDeleted && c.status !== "completed");

    if (activeChallenges.length === 0) return;

    for (const challenge of activeChallenges) {
      try {
        const { groupIds } = extractChallengeGroupIds(challenge);
        const { members: liveMembers } =
          await fetchYptRosterForChallengeNode(groupIds);

        const [yesterdaySnapData, freshChallengeData] = await Promise.all([
          fetchFirestoreRestDoc(
            `yptChallenges/${challenge.id}/dailySnapshots/${yesterdayYmd}`
          ),
          fetchFirestoreRestDoc(`yptChallenges/${challenge.id}`),
        ]);

        const storedBank = extractStoredMemoryBank(
          freshChallengeData,
          yesterdaySnapData,
          yesterdayYmd,
          false
        );

        const { snapshotData: lockedYesterdayData, participantStandings } =
          buildChallengeDaySnapshotAndUpdates(
            challenge,
            liveMembers,
            yesterdayYmd,
            storedBank,
            true
          );

        await setFirestoreRestDoc(
          `yptChallenges/${challenge.id}/dailySnapshots/${yesterdayYmd}`,
          lockedYesterdayData,
          true
        );

        const challengeEndDateYmd = getChallengeEndDateYmdNode(challenge);
        if (yesterdayYmd >= challengeEndDateYmd) {
          const allSnapsRaw = await fetchFirestoreRestCollection(
            `yptChallenges/${challenge.id}/dailySnapshots`
          );
          const completionUpdate = buildAutoCompletedChallengeUpdate(
            challenge,
            allSnapsRaw.map((d) => d.data),
            yesterdayYmd,
            challengeEndDateYmd,
            participantStandings
          );
          await updateFirestoreRestDoc(
            `yptChallenges/${challenge.id}`,
            completionUpdate
          );
          console.log(
            `[YPT 5:15 AM REST FINALIZER] Challenge ${challenge.id} auto-completed.`
          );
        } else {
          const todaySnapData = await fetchFirestoreRestDoc(
            `yptChallenges/${challenge.id}/dailySnapshots/${todayYmd}`
          );
          if (!todaySnapData) {
            const freshDayData = buildFreshDaySnapshotData(
              challenge,
              liveMembers,
              todayYmd
            );
            await setFirestoreRestDoc(
              `yptChallenges/${challenge.id}/dailySnapshots/${todayYmd}`,
              freshDayData,
              true
            );
            await updateFirestoreRestDoc(`yptChallenges/${challenge.id}`, {
              dailyHighWaterMarks: {},
              dailyMaxContinuousHighWaterMarks: {},
              dailyCompletedChallenges: {},
              lastDailySnapshotDate: todayYmd,
              lastSyncedAt: new Date().toISOString(),
            });
          }
          console.log(
            `[YPT 5:15 AM REST FINALIZER] Successfully finalized ${yesterdayYmd} and created open snapshot for ${todayYmd} in challenge ${challenge.id} via REST API.`
          );
        }
      } catch (chErr) {
        console.error(
          `[YPT 5:15 AM REST FINALIZER] Error processing challenge ${challenge.id}:`,
          chErr
        );
      }
    }
  } catch (restErr) {
    console.error(
      "[YPT 5:15 AM REST FINALIZER] Fatal error in REST finalizer:",
      restErr
    );
  }
}

/**
 * 5:15 AM IST Daily Finalizer & Day Transition Protocol:
 * - Finalizes yesterday's snapshot with full penalties and sets isLocked: true, lockedBy: 'cron_system'.
 * - Creates a fresh open snapshot for today (or marks challenge completed if yesterday >= endDate).
 * - Automatically falls back to Firestore REST API on Error 7 (PERMISSION_DENIED).
 */
async function execute515AmYptFinalizer(adminDb?: admin.firestore.Firestore) {
  const targetDb = adminDb || getUnifiedAdminDb();
  if (!targetDb) {
    await execute515AmYptFinalizerViaRest();
    return;
  }

  try {
    const yesterdayYmd = getYesterdayYptDayYmdNode();
    const todayYmd = getYptDayYmdNode();
    console.log(
      `[YPT 5:15 AM IST FINALIZER] Executing Day Transition. Concluded: ${yesterdayYmd}, Fresh: ${todayYmd}...`
    );

    const challengesSnap = await targetDb.collection("yptChallenges").get();
    const activeChallenges = challengesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter((c) => !c.isDeleted && c.status !== "completed");

    if (activeChallenges.length === 0) return;

    for (const challenge of activeChallenges) {
      try {
        const { groupIds } = extractChallengeGroupIds(challenge);
        const { members: liveMembers } = await fetchYptRosterForChallengeNode(
          groupIds,
          targetDb
        );

        const challengeDocRef = targetDb
          .collection("yptChallenges")
          .doc(challenge.id);
        const yesterdaySnapRef = challengeDocRef
          .collection("dailySnapshots")
          .doc(yesterdayYmd);

        const [yesterdaySnap, freshChallengeDoc] = await Promise.all([
          yesterdaySnapRef.get(),
          challengeDocRef.get(),
        ]);

        const storedBank = extractStoredMemoryBank(
          freshChallengeDoc.exists ? freshChallengeDoc.data() : null,
          yesterdaySnap.exists ? yesterdaySnap.data() : null,
          yesterdayYmd,
          false
        );

        const { snapshotData: lockedYesterdayData, participantStandings } =
          buildChallengeDaySnapshotAndUpdates(
            challenge,
            liveMembers,
            yesterdayYmd,
            storedBank,
            true
          );

        await yesterdaySnapRef.set(lockedYesterdayData, { merge: true });
        try {
          await challengeDocRef
            .collection("daily_snapshots")
            .doc(`daily_${yesterdayYmd}`)
            .set(lockedYesterdayData, { merge: true });
        } catch {}

        const challengeEndDateYmd = getChallengeEndDateYmdNode(challenge);
        if (yesterdayYmd >= challengeEndDateYmd) {
          const allSnaps = await challengeDocRef
            .collection("dailySnapshots")
            .get();
          const completionUpdate = buildAutoCompletedChallengeUpdate(
            challenge,
            allSnaps.docs.map((d) => d.data()),
            yesterdayYmd,
            challengeEndDateYmd,
            participantStandings
          );

          await challengeDocRef.update(completionUpdate);
          console.log(
            `[YPT 5:15 AM IST FINALIZER] Challenge ${challenge.id} reached end date (${challengeEndDateYmd}) and has been auto-completed with winners resolved.`
          );
        } else {
          const todaySnapRef = challengeDocRef
            .collection("dailySnapshots")
            .doc(todayYmd);
          const todaySnap = await todaySnapRef.get();

          if (!todaySnap.exists) {
            const freshDayData = buildFreshDaySnapshotData(
              challenge,
              liveMembers,
              todayYmd
            );
            await todaySnapRef.set(freshDayData);
            try {
              await challengeDocRef
                .collection("daily_snapshots")
                .doc(`daily_${todayYmd}`)
                .set(freshDayData);
            } catch {}

            await challengeDocRef.update({
              dailyHighWaterMarks: {},
              dailyMaxContinuousHighWaterMarks: {},
              dailyCompletedChallenges: {},
              lastDailySnapshotDate: todayYmd,
              lastSyncedAt: new Date().toISOString(),
            });
          }

          console.log(
            `[YPT 5:15 AM IST FINALIZER] Successfully finalized ${yesterdayYmd} and created open snapshot for ${todayYmd} in ${challenge.id}.`
          );
        }
      } catch (chErr: any) {
        if (isFirestorePermissionError(chErr)) {
          console.warn(
            `[YPT 5:15 AM IST FINALIZER] Challenge ${challenge.id} threw Error 7 (PERMISSION_DENIED). Falling back to REST API finalizer...`
          );
          await execute515AmYptFinalizerViaRest();
          return;
        }
        console.error(
          `[YPT 5:15 AM IST FINALIZER] Error processing challenge ${challenge.id}:`,
          chErr
        );
      }
    }
  } catch (err: any) {
    console.warn(
      "[YPT 5:15 AM IST FINALIZER] Admin Firestore encountered error. Executing via authenticated Firestore REST API fallback..."
    );
    await execute515AmYptFinalizerViaRest();
  }
}

export function startCron() {
  if (db) {
    console.log("Registered 2-hour leaderboard recalculation cron job.");

    cron.schedule("0 */2 * * *", async () => {
      console.log("Running 2-hour leaderboard recalculation task...");
      try {
        const usersSnap = await db.collection("users").get();
        const users = usersSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as any)
        );

        const mocksSnap = await db.collectionGroup("mocks").get();
        const allMocks = mocksSnap.docs
          .map((d) => {
            const data = d.data();
            return { id: d.id, userId: d.ref.parent.parent?.id, ...data };
          })
          .filter((m: any) => !m.isDeleted);

        const userMocks: Record<string, any[]> = {};
        allMocks.forEach((m) => {
          if (m.userId) {
            if (!userMocks[m.userId]) userMocks[m.userId] = [];
            userMocks[m.userId].push(m);
          }
        });

        const batch = db.batch();
        let updatesCount = 0;

        for (const user of users) {
          const mocks = userMocks[user.id] || [];
          if (mocks.length === 0) continue;

          const { avgPercentile, totalTests } = calculateUserStats(mocks);

          if (
            user.avgPercentile !== avgPercentile ||
            user.totalTests !== totalTests
          ) {
            const ref = db.collection("users").doc(user.id);
            batch.update(ref, { avgPercentile, totalTests });
            updatesCount++;
          }

          if (updatesCount >= 400) {
            await batch.commit();
            updatesCount = 0;
          }
        }

        if (updatesCount > 0) {
          await batch.commit();
        }

        console.log(
          `Leaderboard recalculation finished. Updated ${updatesCount} users.`
        );
      } catch (error: any) {
        if (error && error.code === 7) {
          console.warn(
            "\n[WARNING] Leaderboard Cron skipped due to PERMISSION_DENIED."
          );
        } else {
          console.error("Leaderboard Cron failed:", error);
        }
      }
    });

    console.log("Registered nightly search API log auto-delete cron job.");
    cron.schedule("0 0 * * *", async () => {
      console.log("Running nightly search API log auto-delete task...");
      try {
        const settingsDoc = await db.collection("system").doc("settings").get();
        const settings = settingsDoc.data();
        const searchLogAutoDeleteDays = settings?.searchLogAutoDeleteDays;

        if (
          typeof searchLogAutoDeleteDays === "number" &&
          searchLogAutoDeleteDays > 0
        ) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - searchLogAutoDeleteDays);

          const oldLogsSnap = await db
            .collection("search_api_logs")
            .where(
              "createdAt",
              "<",
              admin.firestore.Timestamp.fromDate(cutoffDate)
            )
            .get();

          if (!oldLogsSnap.empty) {
            let batch = db.batch();
            let deletesCount = 0;
            let totalDeleted = 0;

            for (const doc of oldLogsSnap.docs) {
              batch.delete(doc.ref);
              deletesCount++;
              totalDeleted++;

              if (deletesCount >= 400) {
                await batch.commit();
                batch = db.batch();
                deletesCount = 0;
              }
            }

            if (deletesCount > 0) {
              await batch.commit();
            }

            console.log(
              `Successfully deleted ${totalDeleted} search API logs.`
            );
          }
        }
      } catch (error: any) {
        if (error && error.code === 7) {
          console.warn(
            "\n[WARNING] Auto-Delete Cron skipped due to PERMISSION_DENIED in sandbox environment.\n"
          );
        } else {
          console.error("Search API Log Auto-Delete Cron failed:", error);
        }
      }
    });
  }
}

export {
  execute15MinYptSync as executeContinuousYptSync,
  execute15MinYptSync,
  execute515AmYptFinalizer,
};
