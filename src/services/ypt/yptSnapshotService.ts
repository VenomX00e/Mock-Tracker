import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  YptChallenge,
  YptApiMember,
  YptDailyDaySnapshot,
  YptTeam,
} from "../../types/yptTypes";
import {
  getLocalYmd,
  getYptDayYmd,
  getYesterdayYptDayYmd,
  applyHighWaterMark,
  areYptHandlesMatching,
  getChallengeStartDateYmd,
  getChallengeEndDateYmd,
  getMemberStudyHoursFromApi,
} from "../../utils/yptUtils";
import {
  CHALLENGES_COLLECTION,
  sanitizeForFirestore,
  fetchYptDayLog,
} from "./yptApiClient";
import {
  calculatePointsFromRules,
  applyTeamWideRulesToSnapshot,
} from "./yptPointEngine";
import { getYptChallenge, updateYptChallenge } from "../yptService";

function getSnapshotDocRefs(challengeId: string, targetDateYmd: string) {
  return {
    canonicalRef: doc(
      db,
      CHALLENGES_COLLECTION,
      challengeId,
      "dailySnapshots",
      targetDateYmd
    ),
    legacyRef: doc(
      db,
      CHALLENGES_COLLECTION,
      challengeId,
      "daily_snapshots",
      `daily_${targetDateYmd}`
    ),
    altLegacyRef: doc(
      db,
      CHALLENGES_COLLECTION,
      challengeId,
      "daily_snapshots",
      targetDateYmd
    ),
  };
}

/**
 * Saves or updates a daily finalized snapshot for a challenge in Firestore.
 * Stored at: yptChallenges/{challengeId}/dailySnapshots/{targetDateYmd}
 * and mirrored to daily_snapshots/daily_{targetDateYmd} for backwards compatibility.
 */
export async function saveDailySnapshot(
  challengeId: string,
  snapshot: YptDailyDaySnapshot
): Promise<void> {
  const dateYmd = snapshot.dateYmd || snapshot.targetDateYmd || getYptDayYmd();
  const { canonicalRef, legacyRef } = getSnapshotDocRefs(challengeId, dateYmd);

  const dataToSave: YptDailyDaySnapshot = {
    ...snapshot,
    id: dateYmd,
    challengeId,
    dateYmd,
    targetDateYmd: dateYmd,
  };

  const cleanData = sanitizeForFirestore(dataToSave);

  await setDoc(canonicalRef, cleanData, { merge: true });
  try {
    await setDoc(legacyRef, cleanData, { merge: true });
  } catch {
    // Ignore legacy mirror errors
  }
}

/**
 * Retrieves a single daily finalized snapshot for a given challenge and date.
 */
export async function getDailySnapshot(
  challengeId: string,
  targetDateYmd: string
): Promise<YptDailyDaySnapshot | null> {
  const { canonicalRef, legacyRef, altLegacyRef } = getSnapshotDocRefs(
    challengeId,
    targetDateYmd
  );

  for (const ref of [canonicalRef, legacyRef, altLegacyRef]) {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data() as any;
      return {
        ...d,
        id: snap.id,
        dateYmd: d.dateYmd || targetDateYmd,
        targetDateYmd: d.targetDateYmd || d.dateYmd || targetDateYmd,
      } as YptDailyDaySnapshot;
    }
  }

  return null;
}

/**
 * Retrieves all stored daily finalized snapshots for a given challenge.
 */
export async function getAllDailySnapshots(
  challengeId: string
): Promise<YptDailyDaySnapshot[]> {
  const snapshotsMap = new Map<string, YptDailyDaySnapshot>();

  for (const subcol of ["dailySnapshots", "daily_snapshots"]) {
    try {
      const colRef = collection(db, CHALLENGES_COLLECTION, challengeId, subcol);
      const snap = await getDocs(colRef);
      snap.forEach((d) => {
        const data = d.data() as any;
        const dateYmd =
          data.dateYmd || data.targetDateYmd || d.id.replace(/^daily_/, "");
        if (!snapshotsMap.has(dateYmd)) {
          snapshotsMap.set(dateYmd, {
            ...data,
            id: d.id,
            dateYmd,
            targetDateYmd: dateYmd,
          } as YptDailyDaySnapshot);
        }
      });
    } catch (err) {
      console.warn(`Could not query ${subcol}:`, err);
    }
  }

  return Array.from(snapshotsMap.values()).sort((a, b) =>
    (a.dateYmd || a.targetDateYmd || "").localeCompare(
      b.dateYmd || b.targetDateYmd || ""
    )
  );
}

/**
 * Deletes a daily snapshot for a challenge.
 */
export async function deleteDailySnapshot(
  challengeId: string,
  targetDateYmd: string
): Promise<void> {
  const { canonicalRef, legacyRef } = getSnapshotDocRefs(
    challengeId,
    targetDateYmd
  );
  await deleteDoc(canonicalRef);
  try {
    await deleteDoc(legacyRef);
  } catch {
    // Ignore legacy delete errors
  }
}

/**
 * Recalculates points for each team in the challenge directly from all dailySnapshots.
 */
export async function recalculateTeamPointsFromSnapshots(
  challengeId: string
): Promise<YptTeam[]> {
  const challenge = await getYptChallenge(challengeId);
  if (!challenge || !Array.isArray(challenge.teams)) return [];

  const dailySnapshots = await getAllDailySnapshots(challengeId);

  const updatedTeams: YptTeam[] = challenge.teams.map((team) => {
    let teamTotal = 0;

    dailySnapshots.forEach((snapshot) => {
      if (
        snapshot.teamPointsMap &&
        typeof snapshot.teamPointsMap[team.id] === "number"
      ) {
        teamTotal += snapshot.teamPointsMap[team.id];
      } else if (Array.isArray(snapshot.memberRecords)) {
        snapshot.memberRecords.forEach((rec) => {
          if (
            rec.teamId === team.id ||
            (team.memberUids || []).some((m) =>
              areYptHandlesMatching(m, rec.yptHandle, rec.userId)
            )
          ) {
            teamTotal += rec.netPoints || 0;
          }
        });
      } else if (snapshot.memberSnapshots) {
        Object.values(snapshot.memberSnapshots).forEach((ms) => {
          if (
            (team.memberUids || []).some((m) =>
              areYptHandlesMatching(
                m,
                ms.handle,
                ms.rawYptUd ? String(ms.rawYptUd) : undefined
              )
            )
          ) {
            teamTotal += ms.netPoints || 0;
          }
        });
      }
    });

    return {
      ...team,
      totalPoints: teamTotal,
    };
  });

  await updateYptChallenge(challengeId, { teams: updatedTeams });
  return updatedTeams;
}

export const recalculateTeamPointsFromSubmissions =
  recalculateTeamPointsFromSnapshots;

/**
 * One-Time Cleanup / Admin Reset for a specific date's snapshot and challenge High-Water Marks.
 */
export async function resetTodayChallengeData(
  challengeId: string,
  targetDateYmd?: string
): Promise<void> {
  const activeYmd = targetDateYmd || getYptDayYmd();
  const challengeRef = doc(db, CHALLENGES_COLLECTION, challengeId);

  await updateDoc(challengeRef, {
    dailyHighWaterMarks: {},
    maxContinuousHighWaterMarks: {},
    dailyCompletedChallenges: {},
    lastDailySnapshotDate: activeYmd,
    updatedAt: new Date().toISOString(),
  });

  try {
    await deleteDailySnapshot(challengeId, activeYmd);
  } catch (e) {
    console.warn("Could not delete dailySnapshots doc during reset:", e);
  }

  await recalculateTeamPointsFromSnapshots(challengeId);
}

/**
 * Auto-closes and locks any missing or unlocked past daily snapshots for a challenge.
 */
export async function autoCloseMissingDays(
  challenge: YptChallenge
): Promise<{ closedCount: number; newSnapshots: YptDailyDaySnapshot[] }> {
  if (!challenge || !challenge.id) {
    return { closedCount: 0, newSnapshots: [] };
  }

  const startDateYmd = getChallengeStartDateYmd(challenge);
  const endDateYmd = getChallengeEndDateYmd(challenge);
  const currentYptDay = getYptDayYmd();
  const yesterdayYmd = getYesterdayYptDayYmd();
  const maxCloseDateYmd =
    endDateYmd < yesterdayYmd ? endDateYmd : yesterdayYmd;

  if (!startDateYmd || !maxCloseDateYmd || startDateYmd > maxCloseDateYmd) {
    return { closedCount: 0, newSnapshots: [] };
  }

  const [startY, startM, startD] = startDateYmd.split("-").map(Number);
  const [endY, endM, endD] = maxCloseDateYmd.split("-").map(Number);
  if (!startY || !startM || !startD || !endY || !endM || !endD) {
    return { closedCount: 0, newSnapshots: [] };
  }

  const dateList: string[] = [];
  const curDate = new Date(startY, startM - 1, startD);
  const finishDate = new Date(endY, endM - 1, endD);
  while (curDate <= finishDate) {
    dateList.push(getLocalYmd(curDate));
    curDate.setDate(curDate.getDate() + 1);
  }

  if (dateList.length === 0) {
    return { closedCount: 0, newSnapshots: [] };
  }

  const existingSnapshots = await getAllDailySnapshots(challenge.id);
  const snapshotMap = new Map<string, YptDailyDaySnapshot>();
  existingSnapshots.forEach((s) => {
    const key = s.targetDateYmd || s.dateYmd;
    if (key) snapshotMap.set(key, s);
  });

  const datesToFinalize = dateList.filter((d) => {
    const snap = snapshotMap.get(d);
    return !snap || !snap.isLocked;
  });

  existingSnapshots.forEach((s) => {
    const sDate = s.targetDateYmd || s.dateYmd;
    if (
      sDate &&
      sDate < currentYptDay &&
      !s.isLocked &&
      !datesToFinalize.includes(sDate)
    ) {
      datesToFinalize.push(sDate);
    }
  });

  if (datesToFinalize.length === 0) {
    return { closedCount: 0, newSnapshots: [] };
  }

  datesToFinalize.sort();
  const newSnapshots: YptDailyDaySnapshot[] = [];

  for (const dateYmd of datesToFinalize) {
    try {
      const finalizedSnapshot = await syncChallengeDaySnapshotWithHighWaterMark(
        challenge,
        [],
        dateYmd,
        true
      );
      newSnapshots.push(finalizedSnapshot);
    } catch (err) {
      console.warn(
        `[AutoCloser] Failed to finalize past day snapshot for date ${dateYmd}:`,
        err
      );
    }
  }

  if (newSnapshots.length > 0) {
    await recalculateTeamPointsFromSnapshots(challenge.id);
  }

  return {
    closedCount: newSnapshots.length,
    newSnapshots,
  };
}

/**
 * Shared Member Snapshot Evaluator used by both Solo Mode and Team Mode inside syncChallengeDaySnapshotWithHighWaterMark.
 */
function evaluateClientMemberForSnapshot(
  memberSpec: {
    yptHandle: string;
    yptUd?: number;
    appUserId?: string;
    teamId?: string;
  },
  challenge: YptChallenge,
  effectiveLiveRoster: YptApiMember[],
  existingSnapshot: YptDailyDaySnapshot | null,
  updatedHwms: Record<string, number>,
  updatedMaxContHwms: Record<string, number>,
  isPastLockedDate: boolean,
  applyPenalty: boolean
) {
  const cleanHandle = (memberSpec.yptHandle || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  const memberHandleOrUid = memberSpec.yptHandle || cleanHandle;
  const fallbackUidStr = memberSpec.yptUd
    ? String(memberSpec.yptUd)
    : undefined;

  const existingMemberSnap = existingSnapshot?.memberSnapshots?.[cleanHandle];
  const existingRecord = (existingSnapshot?.memberRecords || []).find((r) =>
    areYptHandlesMatching(
      r.yptHandle,
      memberHandleOrUid,
      r.userId || fallbackUidStr
    )
  );

  const liveMember = (effectiveLiveRoster || []).find((m) => {
    if (!m) return false;
    const mHandle = (m.n || "").replace(/^@/, "").trim();
    const mUid = m.ud ? String(m.ud) : undefined;
    return areYptHandlesMatching(
      mHandle,
      memberHandleOrUid,
      mUid || fallbackUidStr
    );
  });

  const apiLiveHours = liveMember ? getMemberStudyHoursFromApi(liveMember) : 0;
  const existingSnapHours =
    existingMemberSnap?.hoursStudied ?? existingRecord?.hoursStudied ?? 0;

  const prevHwm = updatedHwms[cleanHandle] ?? 0;
  const peakHours = applyHighWaterMark(
    prevHwm,
    Math.max(apiLiveHours, existingSnapHours)
  );
  updatedHwms[cleanHandle] = peakHours;

  const apiLiveMaxContMs =
    liveMember?.dl && typeof liveMember.dl.mm === "number"
      ? liveMember.dl.mm
      : 0;
  const existingMaxContMs = existingMemberSnap?.maxContinuousMs || 0;
  const prevMaxContHwm = updatedMaxContHwms[cleanHandle] ?? 0;
  const peakMaxContMs = Math.max(
    prevMaxContHwm,
    apiLiveMaxContMs,
    existingMaxContMs
  );
  updatedMaxContHwms[cleanHandle] = peakMaxContMs;

  const completedChallengeIds: number[] = [];
  if (
    !isPastLockedDate &&
    liveMember?.cls &&
    typeof liveMember.cls === "object"
  ) {
    Object.entries(liveMember.cls).forEach(([cid, statusObj]) => {
      if (
        statusObj &&
        typeof statusObj === "object" &&
        (statusObj as any).st === 1
      ) {
        const numCid = Number(cid);
        if (!isNaN(numCid)) completedChallengeIds.push(numCid);
      }
    });
  } else if (existingMemberSnap?.completedNativeChallengeIds) {
    completedChallengeIds.push(
      ...existingMemberSnap.completedNativeChallengeIds
    );
  } else if (existingRecord?.completedChallengeIds) {
    completedChallengeIds.push(...existingRecord.completedChallengeIds);
  }

  const existingRuleList =
    existingMemberSnap?.appliedRuleBreakdown ||
    existingRecord?.appliedRules ||
    [];
  const detectedRuleEmojis = existingRuleList
    .filter(
      (r: any) =>
        r.ruleId !== "base_study" &&
        r.ruleId !== "no_study_penalty" &&
        r.ruleId !== "max_continuous_penalty" &&
        r.ruleId !== "manual_bonus_xp"
    )
    .map((r: any) => r.emoji || "")
    .filter(Boolean);

  const calculated = calculatePointsFromRules(
    peakHours,
    challenge.rules,
    detectedRuleEmojis,
    false,
    completedChallengeIds,
    applyPenalty,
    peakMaxContMs
  );

  const appliedRules = (calculated.appliedRules || []).map((r) => ({
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    emoji: r.emoji || "⭐",
    points: r.points || 0,
  }));

  let manualExtraPoints = 0;
  existingRuleList.forEach((er: any) => {
    const isSystemRule =
      er.ruleId === "base_study" ||
      er.ruleId === "no_study_penalty" ||
      er.ruleId === "max_continuous_penalty";
    if (isSystemRule) return;

    const alreadyIncluded = appliedRules.some(
      (ar) =>
        (er.ruleId && ar.ruleId === er.ruleId) ||
        ar.ruleName.toLowerCase() === (er.ruleName || "").toLowerCase()
    );
    if (!alreadyIncluded) {
      appliedRules.push({
        ruleId: er.ruleId,
        ruleName: er.ruleName,
        emoji: er.emoji || "⭐",
        points: er.points || 0,
      });
      manualExtraPoints += er.points || 0;
    }
  });

  const finalBonusPoints =
    calculated.bonusPoints + (manualExtraPoints > 0 ? manualExtraPoints : 0);
  const finalPenaltyPoints =
    calculated.penaltyPoints +
    (manualExtraPoints < 0 ? Math.abs(manualExtraPoints) : 0);
  const finalNetPoints = calculated.totalPoints + manualExtraPoints;

  const appliedRuleBreakdown = appliedRules.map((r) => ({
    ruleId: r.ruleId || "",
    ruleName: r.ruleName,
    emoji: r.emoji,
    points: r.points,
    type: (r.points < 0
      ? "penalty"
      : r.points > 0
      ? "bonus"
      : "base") as "bonus" | "penalty" | "base" | "milestone",
  }));

  const isCurrentlyStudying = isPastLockedDate
    ? false
    : Boolean(liveMember?.dl?.is);
  const resolvedUd =
    liveMember?.ud || existingMemberSnap?.rawYptUd || memberSpec.yptUd;

  const snapshotEntry = {
    handle:
      existingMemberSnap?.handle ||
      liveMember?.n ||
      memberSpec.yptHandle ||
      cleanHandle,
    rawYptUd: resolvedUd,
    appUserId: memberSpec.appUserId || existingMemberSnap?.appUserId,
    hoursStudied: peakHours,
    studyMs: Math.round(peakHours * 3600000),
    maxContinuousMs: peakMaxContMs,
    isCurrentlyStudying,
    completedNativeChallengeIds: completedChallengeIds,
    basePoints: calculated.baseStudyPoints,
    bonusPoints: finalBonusPoints,
    penaltyPoints: finalPenaltyPoints,
    netPoints: finalNetPoints,
    appliedRuleBreakdown,
    status: "active" as const,
    lastSyncedAt: new Date().toISOString(),
  };

  const recordEntry = {
    yptHandle: existingRecord?.yptHandle || cleanHandle,
    userId:
      existingRecord?.userId || (resolvedUd ? String(resolvedUd) : undefined),
    ...(memberSpec.teamId ? { teamId: memberSpec.teamId } : {}),
    hoursStudied: peakHours,
    basePoints: calculated.baseStudyPoints,
    bonusPoints: finalBonusPoints,
    penaltyPoints: finalPenaltyPoints,
    netPoints: finalNetPoints,
    isCurrentlyStudying,
    appliedRules,
    completedChallengeIds,
  };

  return {
    cleanHandle,
    peakHours,
    netPoints: finalNetPoints,
    snapshotEntry,
    recordEntry,
  };
}

function finalizeSnapshotTotalsAndStandings(
  challenge: YptChallenge,
  snapshot: YptDailyDaySnapshot,
  applyPenalty: boolean
): YptDailyDaySnapshot {
  const isSoloMode = (challenge.mode || "team") === "individual";
  const memberSnapshots = snapshot.memberSnapshots || {};
  const memberRecords = snapshot.memberRecords || [];

  applyTeamWideRulesToSnapshot(
    challenge,
    memberSnapshots,
    memberRecords,
    applyPenalty
  );

  let dayTotalHours = 0;
  let dayTotalPoints = 0;
  let activeMemberCount = 0;
  const teamPointsMap: Record<string, number> = {};
  const teamStandingsDraft: Array<{
    teamId: string;
    teamName: string;
    dayHours: number;
    dayPoints: number;
  }> = [];

  if (isSoloMode) {
    Object.values(memberSnapshots).forEach((m) => {
      if ((m.hoursStudied || 0) > 0) activeMemberCount++;
      dayTotalHours += m.hoursStudied || 0;
      dayTotalPoints += m.netPoints || 0;
    });

    const participantDraft = Object.values(memberSnapshots).map((m) => ({
      yptUd: m.rawYptUd,
      yptHandle: m.handle,
      appUserId: m.appUserId,
      dayHours: m.hoursStudied || 0,
      dayPoints: m.netPoints || 0,
    }));
    participantDraft.sort(
      (a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours
    );
    snapshot.participantStandings = participantDraft.map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));
    snapshot.teamStandings = [];
  } else {
    (challenge.teams || []).forEach((team) => {
      let teamDailyPoints = 0;
      let teamDailyHours = 0;

      (team.memberUids || []).forEach((memberHandleOrUid) => {
        const cleanHandle = (memberHandleOrUid || "")
          .replace(/^@/, "")
          .trim()
          .toLowerCase();
        const memSnap = memberSnapshots[cleanHandle];
        const memRec = memberRecords.find((r) =>
          areYptHandlesMatching(r.yptHandle, memberHandleOrUid, r.userId)
        );
        const hrs = memSnap?.hoursStudied ?? memRec?.hoursStudied ?? 0;
        const pts = memSnap?.netPoints ?? memRec?.netPoints ?? 0;
        if (hrs > 0) activeMemberCount++;
        teamDailyHours += hrs;
        teamDailyPoints += pts;
      });

      dayTotalHours += teamDailyHours;
      dayTotalPoints += teamDailyPoints;
      teamPointsMap[team.id] = teamDailyPoints;
      teamStandingsDraft.push({
        teamId: team.id,
        teamName: team.name || `Team ${team.id}`,
        dayHours: teamDailyHours,
        dayPoints: teamDailyPoints,
      });
    });

    teamStandingsDraft.sort(
      (a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours
    );
    snapshot.teamStandings = teamStandingsDraft.map((t, idx) => ({
      ...t,
      rank: idx + 1,
    }));
  }

  snapshot.totalChallengeHours = dayTotalHours;
  snapshot.totalChallengePoints = dayTotalPoints;
  snapshot.totalPointsAwarded = dayTotalPoints;
  snapshot.activeMemberCount = activeMemberCount;
  snapshot.teamPointsMap = teamPointsMap;

  return snapshot;
}

/**
 * Principle B: The "High-Water Mark" Continuous Live Sync
 * Updates or creates the active snapshot for a challenge using non-destructive Math.max logic.
 */
export async function syncChallengeDaySnapshotWithHighWaterMark(
  challenge: YptChallenge,
  liveRoster: YptApiMember[],
  targetDateYmd?: string,
  forceFinalLock: boolean = false
): Promise<YptDailyDaySnapshot> {
  if (!challenge || !challenge.id) {
    throw new Error("Invalid challenge object");
  }

  const activeYmd = targetDateYmd || getYptDayYmd();
  const endDateYmd = getChallengeEndDateYmd(challenge);

  if (activeYmd > endDateYmd && !forceFinalLock) {
    const existingSnap = await getDailySnapshot(challenge.id, activeYmd);
    if (existingSnap) return existingSnap;
    const lastValidSnap = await getDailySnapshot(challenge.id, endDateYmd);
    if (lastValidSnap) return lastValidSnap;
  }

  const existingSnapshot = await getDailySnapshot(challenge.id, activeYmd);
  if (existingSnapshot?.isLocked && !forceFinalLock) {
    return existingSnapshot;
  }

  const isStaleChallengeDocDate =
    challenge.lastDailySnapshotDate &&
    challenge.lastDailySnapshotDate < activeYmd;

  const existingHwms: Record<string, number> =
    existingSnapshot?.highWaterMarks ||
    (isStaleChallengeDocDate ? {} : (challenge.dailyHighWaterMarks as any) || {});
  const updatedHwms: Record<string, number> = { ...existingHwms };
  const existingMaxContHwms: Record<string, number> =
    existingSnapshot?.maxContinuousHighWaterMarks ||
    (isStaleChallengeDocDate
      ? {}
      : (challenge.dailyMaxContinuousHighWaterMarks as any) || {});
  const updatedMaxContHwms: Record<string, number> = {
    ...existingMaxContHwms,
  };

  const isSoloMode = (challenge.mode || "team") === "individual";
  const memberRecords: NonNullable<YptDailyDaySnapshot["memberRecords"]> = [];
  const memberSnapshots: YptDailyDaySnapshot["memberSnapshots"] = {};

  const isPastLockedDate = activeYmd < getYptDayYmd();
  const applyPenalty = isPastLockedDate || forceFinalLock;
  const effectiveLiveRoster = isPastLockedDate ? [] : liveRoster || [];

  if (isSoloMode) {
    const participantsList: Array<{
      yptUd?: number;
      yptHandle: string;
      appUserId?: string;
    }> =
      challenge.participants && challenge.participants.length > 0
        ? challenge.participants
        : effectiveLiveRoster.map((m) => ({ yptUd: m.ud, yptHandle: m.n }));

    participantsList.forEach((p) => {
      const evaluated = evaluateClientMemberForSnapshot(
        p,
        challenge,
        effectiveLiveRoster,
        existingSnapshot,
        updatedHwms,
        updatedMaxContHwms,
        isPastLockedDate,
        applyPenalty
      );

      memberSnapshots[evaluated.cleanHandle] = evaluated.snapshotEntry;
      memberRecords.push(evaluated.recordEntry);
    });
  } else {
    (challenge.teams || []).forEach((team) => {
      (team.memberUids || []).forEach((memberHandleOrUid) => {
        const evaluated = evaluateClientMemberForSnapshot(
          { yptHandle: memberHandleOrUid, teamId: team.id },
          challenge,
          effectiveLiveRoster,
          existingSnapshot,
          updatedHwms,
          updatedMaxContHwms,
          isPastLockedDate,
          applyPenalty
        );

        memberSnapshots[evaluated.cleanHandle] = evaluated.snapshotEntry;
        memberRecords.push(evaluated.recordEntry);
      });
    });
  }

  const shouldLock = forceFinalLock || isPastLockedDate;
  const draftSnapshot: YptDailyDaySnapshot = {
    id: activeYmd,
    challengeId: challenge.id,
    dateYmd: activeYmd,
    targetDateYmd: activeYmd,
    isLocked: shouldLock,
    lockedAt: shouldLock
      ? existingSnapshot?.lockedAt || new Date().toISOString()
      : undefined,
    lockedBy: shouldLock
      ? existingSnapshot?.lockedBy ||
        (forceFinalLock ? "admin_manual" : "cron_system")
      : undefined,
    totalChallengeHours: 0,
    totalChallengePoints: 0,
    activeMemberCount: 0,
    memberSnapshots,
    teamStandings: [],
    isAutoClosed: shouldLock,
    closedAt: Date.now(),
    totalPointsAwarded: 0,
    teamPointsMap: {},
    highWaterMarks: updatedHwms,
    maxContinuousHighWaterMarks: updatedMaxContHwms,
    memberRecords,
  };

  const finalizedSnapshot = finalizeSnapshotTotalsAndStandings(
    challenge,
    draftSnapshot,
    applyPenalty
  );

  await saveDailySnapshot(challenge.id, finalizedSnapshot);
  await recalculateTeamPointsFromSnapshots(challenge.id);

  return finalizedSnapshot;
}

/**
 * Updates a single member's study hours, custom rule badges, or manual XP adjustment
 * directly in the target date's dailySnapshot and recalculates team totals.
 * For Today, sets the member's High-Water Mark to the manually edited hours so future
 * live syncs preserve the manual value unless the member studies strictly more hours.
 */
export async function updateMemberInDailySnapshot(
  challenge: YptChallenge,
  memberHandleRaw: string,
  targetDateYmd: string,
  updates: {
    hoursStudied?: number;
    appliedRules?: Array<{
      ruleId?: string;
      ruleName: string;
      emoji: string;
      points: number;
      type?: "bonus" | "penalty" | "base" | "milestone";
    }>;
    manualBonusXp?: number;
  }
): Promise<YptDailyDaySnapshot> {
  if (!challenge || !challenge.id) {
    throw new Error("Invalid challenge object");
  }

  const todayYmd = getYptDayYmd();
  const isPastDate = targetDateYmd < todayYmd;

  let snapshot = await getDailySnapshot(challenge.id, targetDateYmd);
  if (!snapshot) {
    snapshot = await syncChallengeDaySnapshotWithHighWaterMark(
      challenge,
      [],
      targetDateYmd,
      isPastDate
    );
  }

  const cleanHandle = (memberHandleRaw || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();

  const memberSnapshots = { ...(snapshot.memberSnapshots || {}) };
  const memberRecords = [...(snapshot.memberRecords || [])];
  const highWaterMarks = { ...(snapshot.highWaterMarks || {}) };

  let matchedKey = cleanHandle;
  for (const key of Object.keys(memberSnapshots)) {
    if (
      key === cleanHandle ||
      areYptHandlesMatching(memberSnapshots[key].handle, memberHandleRaw)
    ) {
      matchedKey = key;
      break;
    }
  }

  const existingMemberSnap = memberSnapshots[matchedKey];
  const existingRecIdx = memberRecords.findIndex((r) =>
    areYptHandlesMatching(r.yptHandle, memberHandleRaw, r.userId)
  );
  const existingRec =
    existingRecIdx >= 0 ? memberRecords[existingRecIdx] : undefined;

  const nextHours =
    updates.hoursStudied !== undefined
      ? Math.max(0, Number(updates.hoursStudied.toFixed(2)))
      : existingMemberSnap?.hoursStudied ?? existingRec?.hoursStudied ?? 0;

  const maxContMs = existingMemberSnap?.maxContinuousMs || 0;
  const completedNativeChallengeIds =
    existingMemberSnap?.completedNativeChallengeIds ||
    existingRec?.completedChallengeIds ||
    [];

  const applyPenalty = isPastDate || Boolean(snapshot.isLocked);

  const customRuleInputs =
    updates.appliedRules !== undefined
      ? updates.appliedRules
      : (
          existingMemberSnap?.appliedRuleBreakdown ||
          existingRec?.appliedRules ||
          []
        ).filter(
          (r: any) =>
            r.ruleId !== "base_study" &&
            r.ruleId !== "no_study_penalty" &&
            r.ruleId !== "max_continuous_penalty" &&
            r.ruleId !== "manual_bonus_xp"
        );

  const manualXpVal =
    updates.manualBonusXp !== undefined
      ? updates.manualBonusXp
      : (
          existingMemberSnap?.appliedRuleBreakdown ||
          existingRec?.appliedRules ||
          []
        ).find((r: any) => r.ruleId === "manual_bonus_xp")?.points || 0;

  const calculated = calculatePointsFromRules(
    nextHours,
    challenge.rules,
    [],
    false,
    completedNativeChallengeIds,
    applyPenalty,
    maxContMs
  );

  // Start with system rules (base study points, no-study penalty, max continuous penalty)
  const systemRules = (calculated.appliedRules || []).filter(
    (r) =>
      r.ruleId === "base_study" ||
      r.ruleId === "no_study_penalty" ||
      r.ruleId === "max_continuous_penalty"
  );

  const mergedRules: Array<{
    ruleId: string;
    ruleName: string;
    emoji: string;
    points: number;
    type: "bonus" | "penalty" | "base" | "milestone";
  }> = systemRules.map((r) => ({
    ruleId: r.ruleId || "",
    ruleName: r.ruleName,
    emoji: r.emoji || "⭐",
    points: r.points || 0,
    type: r.points < 0 ? "penalty" : r.points > 0 ? "bonus" : "base",
  }));

  let customBonusPoints = 0;
  let customPenaltyPoints = 0;

  customRuleInputs.forEach((cr) => {
    const pts = cr.points || 0;
    if (pts >= 0) customBonusPoints += pts;
    else customPenaltyPoints += Math.abs(pts);

    mergedRules.push({
      ruleId: cr.ruleId || `custom_${cr.ruleName.toLowerCase().replace(/\s+/g, "_")}`,
      ruleName: cr.ruleName,
      emoji: cr.emoji || (pts >= 0 ? "☀️" : "📱"),
      points: pts,
      type: (cr as any).type || (pts < 0 ? "penalty" : "bonus"),
    });
  });

  if (manualXpVal !== 0) {
    if (manualXpVal > 0) customBonusPoints += manualXpVal;
    else customPenaltyPoints += Math.abs(manualXpVal);

    mergedRules.push({
      ruleId: "manual_bonus_xp",
      ruleName: "Manual XP Adjustment",
      emoji: manualXpVal > 0 ? "✨" : "⚠️",
      points: manualXpVal,
      type: manualXpVal > 0 ? "bonus" : "penalty",
    });
  }

  const baseStudyPts = calculated.baseStudyPoints;
  const sysPenaltyPts = systemRules
    .filter((r) => r.points < 0)
    .reduce((acc, r) => acc + Math.abs(r.points), 0);

  const totalBonusPts = customBonusPoints;
  const totalPenaltyPts = sysPenaltyPts + customPenaltyPoints;
  const netPoints = baseStudyPts + totalBonusPts - totalPenaltyPts;

  const targetTeam = (challenge.teams || []).find((t) =>
    (t.memberUids || []).some((m) => areYptHandlesMatching(m, memberHandleRaw))
  );

  const updatedSnapEntry = {
    handle:
      existingMemberSnap?.handle ||
      memberHandleRaw.replace(/^@/, "").trim() ||
      matchedKey,
    rawYptUd: existingMemberSnap?.rawYptUd,
    appUserId: existingMemberSnap?.appUserId,
    hoursStudied: nextHours,
    studyMs: Math.round(nextHours * 3600000),
    maxContinuousMs: maxContMs,
    isCurrentlyStudying: existingMemberSnap?.isCurrentlyStudying || false,
    completedNativeChallengeIds,
    basePoints: baseStudyPts,
    bonusPoints: totalBonusPts,
    penaltyPoints: totalPenaltyPts,
    netPoints,
    appliedRuleBreakdown: mergedRules,
    status: "active" as const,
    lastSyncedAt: new Date().toISOString(),
  };

  memberSnapshots[matchedKey] = updatedSnapEntry;

  const updatedRecEntry = {
    yptHandle: existingRec?.yptHandle || matchedKey,
    userId: existingRec?.userId,
    ...(targetTeam?.id
      ? { teamId: targetTeam.id }
      : existingRec?.teamId
      ? { teamId: existingRec.teamId }
      : {}),
    hoursStudied: nextHours,
    basePoints: baseStudyPts,
    bonusPoints: totalBonusPts,
    penaltyPoints: totalPenaltyPts,
    netPoints,
    isCurrentlyStudying: existingRec?.isCurrentlyStudying || false,
    appliedRules: mergedRules.map((r) => ({
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      emoji: r.emoji,
      points: r.points,
    })),
    completedChallengeIds: completedNativeChallengeIds,
  };

  if (existingRecIdx >= 0) {
    memberRecords[existingRecIdx] = updatedRecEntry;
  } else {
    memberRecords.push(updatedRecEntry);
  }

  if (updates.hoursStudied !== undefined) {
    highWaterMarks[matchedKey] = nextHours;
    highWaterMarks[cleanHandle] = nextHours;

    if (targetDateYmd === todayYmd) {
      try {
        const challengeRef = doc(db, CHALLENGES_COLLECTION, challenge.id);
        await updateDoc(challengeRef, {
          [`dailyHighWaterMarks.${matchedKey}`]: nextHours,
          [`dailyHighWaterMarks.${cleanHandle}`]: nextHours,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("Could not update dailyHighWaterMarks on challenge doc:", e);
      }
    }
  }

  const updatedSnapshot: YptDailyDaySnapshot = {
    ...snapshot,
    memberSnapshots,
    memberRecords,
    highWaterMarks,
  };

  const finalized = finalizeSnapshotTotalsAndStandings(
    challenge,
    updatedSnapshot,
    applyPenalty
  );

  await saveDailySnapshot(challenge.id, finalized);
  await recalculateTeamPointsFromSnapshots(challenge.id);

  return finalized;
}

/**
 * Manually locks and finalizes a day snapshot for a given challenge and date.
 */
export async function lockDaySnapshot(
  challenge: YptChallenge,
  targetDateYmd: string,
  liveRoster?: YptApiMember[]
): Promise<YptDailyDaySnapshot> {
  return syncChallengeDaySnapshotWithHighWaterMark(
    challenge,
    liveRoster || [],
    targetDateYmd,
    true
  );
}

/**
 * Synchronizes historical study logs from YPT (GET /logs/day?date=YYYY-MM-DD) into the challenge.
 */
export async function syncDayLogToChallenge(
  challenge: YptChallenge,
  dateYmd: string,
  targetHandle?: string
): Promise<{
  success: boolean;
  hours: number;
  memberHandle: string;
  message: string;
  subjects?: any[];
}> {
  if (!challenge || !challenge.id) {
    throw new Error("Invalid challenge object");
  }

  const dayLog = await fetchYptDayLog(dateYmd);
  if (dayLog.error) {
    throw new Error(dayLog.error);
  }

  const hours = dayLog.studyHours;
  if (hours <= 0) {
    return {
      success: true,
      hours: 0,
      memberHandle: targetHandle || "User",
      message: `YPT returned 0:00 study time for ${dateYmd}.`,
      subjects: dayLog.subjects,
    };
  }

  let matchedHandle = targetHandle ? targetHandle.replace(/^@/, "").trim() : "";
  if (!matchedHandle && challenge.teams && challenge.teams.length > 0) {
    for (const team of challenge.teams) {
      if (team.memberUids && team.memberUids.length > 0) {
        matchedHandle = team.memberUids[0].replace(/^@/, "").trim();
        break;
      }
    }
  }

  const updatedSnap = await updateMemberInDailySnapshot(
    challenge,
    matchedHandle || "User",
    dateYmd,
    { hoursStudied: hours }
  );
  await lockDaySnapshot(challenge, dateYmd);

  const clean = (matchedHandle || "User").replace(/^@/, "").trim().toLowerCase();
  const memberPoints =
    updatedSnap.memberSnapshots?.[clean]?.netPoints ??
    Math.floor(hours) * (challenge.rules?.pointsPerStudyHour || 1);

  const formattedHours = `${Math.floor(hours)}h ${String(
    Math.round((hours % 1) * 60)
  ).padStart(2, "0")}m`;
  return {
    success: true,
    hours,
    memberHandle: matchedHandle || "User",
    message: `Successfully synced ${formattedHours} (${memberPoints} XP) from YPT for ${dateYmd}!`,
    subjects: dayLog.subjects,
  };
}
