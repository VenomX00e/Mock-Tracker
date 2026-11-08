import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { YptChallenge, YptTeam } from "../types/yptTypes";
import { areYptHandlesMatching } from "../utils/yptUtils";
import { useYptStore } from "../store/useYptStore";

import {
  CHALLENGES_COLLECTION,
  sanitizeForFirestore,
  getYptStoredCredentials,
  saveYptCredentials,
  clearYptCredentials,
  fetchYptGroups,
  fetchYptRoster,
  fetchYptDayLog,
  fetchYptDayLogs,
  claimYptIdentity,
  linkYptRosterToAppUsers,
  getAllKnownYptNames,
  normalizeHandle,
  extractAlpha,
  matchYptHandleToUid,
  getRegisteredUserYptList,
} from "./ypt/yptApiClient";
import type {
  YptDayLogSubject,
  YptDayLogResponse,
  YptUserEntry,
} from "./ypt/yptApiClient";

import {
  evaluatePointRule,
  calculatePointsFromRules,
  calculateMemberPointsForDate,
  applyTeamWideRulesToSnapshot,
} from "./ypt/yptPointEngine";

import {
  saveDailySnapshot,
  getDailySnapshot,
  getAllDailySnapshots,
  deleteDailySnapshot,
  resetTodayChallengeData,
  autoCloseMissingDays,
  syncChallengeDaySnapshotWithHighWaterMark,
  updateMemberInDailySnapshot,
  recalculateTeamPointsFromSnapshots,
  recalculateTeamPointsFromSubmissions,
  lockDaySnapshot,
  syncDayLogToChallenge,
} from "./ypt/yptSnapshotService";

export {
  sanitizeForFirestore,
  getYptStoredCredentials,
  saveYptCredentials,
  clearYptCredentials,
  fetchYptGroups,
  fetchYptRoster,
  fetchYptDayLog,
  fetchYptDayLogs,
  claimYptIdentity,
  linkYptRosterToAppUsers,
  getAllKnownYptNames,
  normalizeHandle,
  extractAlpha,
  matchYptHandleToUid,
  getRegisteredUserYptList,
  evaluatePointRule,
  calculatePointsFromRules,
  calculateMemberPointsForDate,
  applyTeamWideRulesToSnapshot,
  saveDailySnapshot,
  getDailySnapshot,
  getAllDailySnapshots,
  deleteDailySnapshot,
  resetTodayChallengeData,
  autoCloseMissingDays,
  syncChallengeDaySnapshotWithHighWaterMark,
  updateMemberInDailySnapshot,
  recalculateTeamPointsFromSnapshots,
  recalculateTeamPointsFromSubmissions,
  lockDaySnapshot,
  syncDayLogToChallenge,
};

export type {
  YptDayLogSubject,
  YptDayLogResponse,
  YptUserEntry,
};

/**
 * Creates a new YPT Challenge in Firestore.
 */
export async function createYptChallenge(
  challengeData: Omit<YptChallenge, "id" | "createdAt">
): Promise<string> {
  const challengeRef = doc(collection(db, CHALLENGES_COLLECTION));
  const newChallenge: YptChallenge = {
    ...challengeData,
    id: challengeRef.id,
    createdAt: new Date().toISOString(),
  };

  useYptStore.getState().optimisticAddChallenge(newChallenge);

  await setDoc(challengeRef, sanitizeForFirestore(newChallenge));
  return challengeRef.id;
}

/**
 * Retrieves a single YPT Challenge by ID.
 */
export async function getYptChallenge(
  challengeId: string
): Promise<YptChallenge | null> {
  const docRef = doc(db, CHALLENGES_COLLECTION, challengeId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as YptChallenge;
}

/**
 * Retrieves all YPT Challenges from Firestore.
 */
export async function getAllYptChallenges(): Promise<YptChallenge[]> {
  const colRef = collection(db, CHALLENGES_COLLECTION);
  let snap;
  try {
    const q = query(colRef, orderBy("createdAt", "desc"));
    snap = await getDocs(q);
  } catch (e) {
    snap = await getDocs(colRef);
  }
  const challenges = snap.docs.map(
    (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as YptChallenge)
  );
  challenges.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
  return challenges;
}

/**
 * Real-time listener for all YPT Challenges with change delta tracking.
 */
export function subscribeToYptChallenges(
  callback: (
    challenges: YptChallenge[],
    docChanges?: {
      type: "added" | "modified" | "removed";
      item: YptChallenge;
    }[],
    metadata?: { hasPendingWrites: boolean; fromCache: boolean }
  ) => void
): () => void {
  const colRef = collection(db, CHALLENGES_COLLECTION);

  return onSnapshot(
    colRef,
    (snap) => {
      const challenges = snap.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as YptChallenge)
      );
      challenges.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      const changes = snap.docChanges().map((change) => ({
        type: change.type as "added" | "modified" | "removed",
        item: { id: change.doc.id, ...change.doc.data() } as YptChallenge,
      }));

      callback(challenges, changes, {
        hasPendingWrites: snap.metadata.hasPendingWrites,
        fromCache: snap.metadata.fromCache,
      });
    },
    (err) => {
      console.warn("Error listening to YPT challenges:", err);
    }
  );
}

/**
 * Updates an existing YPT Challenge document.
 */
export async function updateYptChallenge(
  challengeId: string,
  updates: Partial<YptChallenge>
): Promise<void> {
  useYptStore.getState().optimisticUpdateChallenge(challengeId, updates);

  const docRef = doc(db, CHALLENGES_COLLECTION, challengeId);
  await setDoc(
    docRef,
    sanitizeForFirestore({
      ...updates,
      updatedAt: new Date().toISOString(),
    }),
    { merge: true }
  );
}

/**
 * Soft-deletes a YPT Challenge from Firestore.
 */
export async function softDeleteYptChallenge(
  challengeId: string
): Promise<void> {
  await updateYptChallenge(challengeId, {
    isDeleted: true,
    status: "deleted",
    deletedAt: new Date().toISOString(),
  });
}

export interface YptChallengeWinnerSummary {
  mode: "team" | "individual";
  winningTeamId?: string;
  winningTeamName?: string;
  winningTeamPoints?: number;
  winningParticipantUd?: number;
  winningParticipantHandle?: string;
  winningParticipantPoints?: number;
  winningParticipantHours?: number;
  finalMvpHandle?: string;
  finalMvpHours?: number;
  topParticipants?: Array<{
    yptUd?: number;
    yptHandle: string;
    appUserId?: string;
    totalPoints: number;
    totalHours: number;
    rank: number;
  }>;
  rankedTeams?: Array<{
    id: string;
    name: string;
    color?: string;
    totalPoints: number;
    totalHours: number;
    rank: number;
  }>;
  grandTotalHours: number;
  totalSubmissions: number;
}

/**
 * Resolves the final tournament winners and standings for a challenge across
 * all dailySnapshots.
 */
export async function resolveChallengeWinners(
  challengeIdOrChallenge: string | YptChallenge
): Promise<YptChallengeWinnerSummary> {
  const challenge: YptChallenge | null =
    typeof challengeIdOrChallenge === "string"
      ? await getYptChallenge(challengeIdOrChallenge)
      : challengeIdOrChallenge;

  if (!challenge) {
    throw new Error(`Challenge not found: ${challengeIdOrChallenge}`);
  }

  const isSoloMode = (challenge.mode || "team") === "individual";
  const dailySnapshots = await getAllDailySnapshots(challenge.id);

  let grandTotalHours = 0;

  if (isSoloMode) {
    const participantMap = new Map<
      string,
      {
        yptUd?: number;
        yptHandle: string;
        appUserId?: string;
        totalPoints: number;
        totalHours: number;
      }
    >();

    (challenge.participants || []).forEach((p) => {
      const cleanKey = (p.yptHandle || "")
        .replace(/^@/, "")
        .trim()
        .toLowerCase();
      if (!cleanKey && !p.yptUd) return;
      participantMap.set(cleanKey || String(p.yptUd), {
        yptUd: p.yptUd,
        yptHandle: p.yptHandle || cleanKey,
        appUserId: p.appUserId,
        totalPoints: 0,
        totalHours: 0,
      });
    });

    const getOrAddParticipant = (
      handle: string,
      yptUd?: number,
      appUserId?: string
    ) => {
      const cleanKey = (handle || "").replace(/^@/, "").trim().toLowerCase();
      for (const existing of participantMap.values()) {
        if (
          areYptHandlesMatching(
            existing.yptHandle,
            handle,
            yptUd ? String(yptUd) : undefined
          )
        ) {
          if (!existing.yptUd && yptUd) existing.yptUd = yptUd;
          if (!existing.appUserId && appUserId) existing.appUserId = appUserId;
          return existing;
        }
      }
      const newEntry = {
        yptUd,
        yptHandle: handle || cleanKey,
        appUserId,
        totalPoints: 0,
        totalHours: 0,
      };
      participantMap.set(cleanKey || String(yptUd || Date.now()), newEntry);
      return newEntry;
    };

    dailySnapshots.forEach((snap) => {
      if (snap.participantStandings && Array.isArray(snap.participantStandings)) {
        snap.participantStandings.forEach((ps) => {
          const entry = getOrAddParticipant(
            ps.yptHandle,
            ps.yptUd,
            ps.appUserId
          );
          entry.totalPoints += ps.dayPoints || 0;
          entry.totalHours += ps.dayHours || 0;
          grandTotalHours += ps.dayHours || 0;
        });
      } else if (snap.memberSnapshots) {
        Object.values(snap.memberSnapshots).forEach((ms) => {
          const entry = getOrAddParticipant(
            ms.handle,
            ms.rawYptUd,
            ms.appUserId
          );
          entry.totalPoints += ms.netPoints || 0;
          entry.totalHours += ms.hoursStudied || 0;
          grandTotalHours += ms.hoursStudied || 0;
        });
      } else if (Array.isArray(snap.memberRecords)) {
        snap.memberRecords.forEach((mr) => {
          const entry = getOrAddParticipant(
            mr.yptHandle,
            mr.userId ? Number(mr.userId) : undefined
          );
          entry.totalPoints += mr.netPoints || 0;
          entry.totalHours += mr.hoursStudied || 0;
          grandTotalHours += mr.hoursStudied || 0;
        });
      }
    });

    const sortedParticipants = Array.from(participantMap.values()).map((p) => ({
      ...p,
      totalHours: Math.round(p.totalHours * 100) / 100,
    }));
    sortedParticipants.sort(
      (a, b) => b.totalPoints - a.totalPoints || b.totalHours - a.totalHours
    );

    const topParticipants = sortedParticipants.map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));

    const topChampion = topParticipants[0];
    const mvpSorted = [...topParticipants].sort(
      (a, b) => b.totalHours - a.totalHours
    );
    const topMvp = mvpSorted[0];

    return {
      mode: "individual",
      winningParticipantUd: topChampion?.yptUd,
      winningParticipantHandle: topChampion?.yptHandle,
      winningParticipantPoints: topChampion?.totalPoints,
      winningParticipantHours: topChampion?.totalHours,
      finalMvpHandle: topMvp?.yptHandle || topChampion?.yptHandle,
      finalMvpHours: topMvp?.totalHours,
      topParticipants,
      grandTotalHours: Math.round(grandTotalHours * 100) / 100,
      totalSubmissions: dailySnapshots.length,
    };
  } else {
    const teamMap = new Map<
      string,
      {
        id: string;
        name: string;
        color?: string;
        totalPoints: number;
        totalHours: number;
        memberUids: string[];
      }
    >();

    (challenge.teams || []).forEach((t) => {
      teamMap.set(t.id, {
        id: t.id,
        name: t.name || `Team ${t.id}`,
        color: t.color,
        totalPoints: 0,
        totalHours: 0,
        memberUids: t.memberUids || [],
      });
    });

    const memberHoursMap = new Map<string, number>();

    dailySnapshots.forEach((snapshot) => {
      if (snapshot.teamStandings && Array.isArray(snapshot.teamStandings)) {
        snapshot.teamStandings.forEach((ts) => {
          const t = teamMap.get(ts.teamId);
          if (t) {
            t.totalPoints += ts.dayPoints || 0;
            t.totalHours += ts.dayHours || 0;
            grandTotalHours += ts.dayHours || 0;
          }
        });
      }

      if (snapshot.memberSnapshots) {
        Object.values(snapshot.memberSnapshots).forEach((ms) => {
          const clean = (ms.handle || "").replace(/^@/, "").trim().toLowerCase();
          memberHoursMap.set(
            clean,
            (memberHoursMap.get(clean) || 0) + (ms.hoursStudied || 0)
          );
        });
      } else if (Array.isArray(snapshot.memberRecords)) {
        snapshot.memberRecords.forEach((mr) => {
          const clean = (mr.yptHandle || "")
            .replace(/^@/, "")
            .trim()
            .toLowerCase();
          memberHoursMap.set(
            clean,
            (memberHoursMap.get(clean) || 0) + (mr.hoursStudied || 0)
          );
        });
      }
    });

    const sortedTeams = Array.from(teamMap.values()).map((t) => ({
      ...t,
      totalHours: Math.round(t.totalHours * 100) / 100,
    }));
    sortedTeams.sort(
      (a, b) => b.totalPoints - a.totalPoints || b.totalHours - a.totalHours
    );

    const rankedTeams = sortedTeams.map((t, idx) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      totalPoints: t.totalPoints,
      totalHours: t.totalHours,
      rank: idx + 1,
    }));

    const winningTeam = rankedTeams[0];
    const sortedMembers = Array.from(memberHoursMap.entries()).map(
      ([handle, hours]) => ({ handle, hours })
    );
    sortedMembers.sort((a, b) => b.hours - a.hours);
    const topMvp =
      sortedMembers.length > 0 && sortedMembers[0].hours > 0
        ? sortedMembers[0]
        : null;

    return {
      mode: "team",
      winningTeamId: winningTeam?.id,
      winningTeamName: winningTeam?.name,
      winningTeamPoints: winningTeam?.totalPoints,
      finalMvpHandle: topMvp?.handle || "",
      finalMvpHours: topMvp?.hours ? Math.round(topMvp.hours * 100) / 100 : 0,
      rankedTeams,
      grandTotalHours: Math.round(grandTotalHours * 100) / 100,
      totalSubmissions: dailySnapshots.length,
    };
  }
}

/**
 * Marks a YPT Challenge as completed and saves completion metadata.
 */
export async function completeYptChallenge(
  challengeId: string,
  summaryData?: {
    completedBy?: string;
    winningTeamId?: string;
    winningParticipantUd?: number;
    winningParticipantHandle?: string;
    finalMvpHandle?: string;
  }
): Promise<YptChallengeWinnerSummary> {
  const calculated = await resolveChallengeWinners(challengeId);
  const isSolo = calculated.mode === "individual";

  const updates: Partial<YptChallenge> = {
    status: "completed",
    completedAt: new Date().toISOString(),
    completedBy: summaryData?.completedBy || "admin",
    winningTeamId: isSolo
      ? ""
      : summaryData?.winningTeamId || calculated.winningTeamId || "",
    winningParticipantUd: isSolo
      ? summaryData?.winningParticipantUd !== undefined
        ? summaryData.winningParticipantUd
        : calculated.winningParticipantUd
      : undefined,
    winningParticipantHandle: isSolo
      ? summaryData?.winningParticipantHandle ||
        calculated.winningParticipantHandle ||
        ""
      : "",
    finalMvpHandle:
      summaryData?.finalMvpHandle || calculated.finalMvpHandle || "",
  };

  await updateYptChallenge(challengeId, updates);
  return calculated;
}

/**
 * Re-opens a completed YPT Challenge back to active status.
 */
export async function reopenYptChallenge(challengeId: string): Promise<void> {
  await updateYptChallenge(challengeId, {
    status: "active",
  });
}

/**
 * Restores a soft-deleted YPT Challenge in Firestore.
 */
export async function restoreYptChallenge(challengeId: string): Promise<void> {
  await updateYptChallenge(challengeId, {
    isDeleted: false,
    status: "active",
  });
}

/**
 * Permanently deletes a YPT Challenge from Firestore.
 */
export async function deleteYptChallenge(challengeId: string): Promise<void> {
  useYptStore.getState().optimisticRemoveChallenge(challengeId);
  const docRef = doc(db, CHALLENGES_COLLECTION, challengeId);
  await deleteDoc(docRef);
}

/**
 * Resets all global leaderboard data by deleting dailySnapshots across all YPT challenges
 * and setting team total points back to 0. Available strictly to the application owner.
 */
export async function resetGlobalLeaderboardData(): Promise<void> {
  const challengesCol = collection(db, CHALLENGES_COLLECTION);
  const challengesSnap = await getDocs(challengesCol);

  for (const challengeDoc of challengesSnap.docs) {
    const challengeId = challengeDoc.id;
    const challengeData = challengeDoc.data() as YptChallenge;

    for (const subcol of ["dailySnapshots", "daily_snapshots"]) {
      const subColRef = collection(db, CHALLENGES_COLLECTION, challengeId, subcol);
      const subSnap = await getDocs(subColRef);

      if (!subSnap.empty) {
        let batch = writeBatch(db);
        let opCount = 0;

        for (const subDoc of subSnap.docs) {
          batch.delete(subDoc.ref);
          opCount++;
          if (opCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            opCount = 0;
          }
        }
        if (opCount > 0) {
          await batch.commit();
        }
      }
    }

    if (Array.isArray(challengeData.teams) && challengeData.teams.length > 0) {
      const resetTeams: YptTeam[] = challengeData.teams.map((team) => ({
        ...team,
        totalPoints: 0,
      }));
      await updateDoc(doc(db, CHALLENGES_COLLECTION, challengeId), {
        teams: resetTeams,
        dailyHighWaterMarks: {},
        maxContinuousHighWaterMarks: {},
        updatedAt: new Date().toISOString(),
      });
    }
  }

  useYptStore.getState().forceRefresh();
}
