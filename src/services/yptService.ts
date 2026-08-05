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
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { YptChallenge, YptExtractedMemberData, YptSubmissionLog, YptTeam } from "../types/yptTypes";
import { getLocalYmd } from "../utils/yptUtils";

const CHALLENGES_COLLECTION = "yptChallenges";

export interface DailyMemberStat {
  memberHandle: string;
  matchedUid?: string;
  dateYmd: string;
  challengeId: string;
  hoursStudied: number;
  pointsEarned: number;
  detectedRules?: Array<{
    ruleId?: string;
    ruleName: string;
    emoji?: string;
    points?: number;
    type?: string;
  }>;
  submissionId: string;
  timestamp: string | number;
}

export function calculateMemberPointsForDate(
  hoursStudied: number,
  rules: YptChallenge['rules'],
  appliedRules?: Array<{ points?: number }>
): number {
  const intervalVal = rules.studyIntervalValue ?? 1;
  const intervalUnit = rules.studyIntervalUnit ?? 'hours';
  const intervalHours = intervalUnit === 'minutes' ? intervalVal / 60 : intervalVal || 1;
  const ptsPerInterval = rules.pointsPerInterval ?? rules.pointsPerStudyHour ?? 1;

  const baseStudyPoints = Math.floor(hoursStudied / (intervalHours || 1)) * ptsPerInterval;

  const penaltyThresholdVal = rules.penaltyThresholdValue ?? rules.noStudyPenaltyThresholdHours ?? 3;
  const penaltyThresholdUnit = rules.penaltyThresholdUnit ?? 'hours';
  const penaltyThresholdHours = penaltyThresholdUnit === 'minutes' ? penaltyThresholdVal / 60 : penaltyThresholdVal || 3;

  const isPenalized = hoursStudied < penaltyThresholdHours;
  const penaltyDeduction = isPenalized ? (rules.penaltyPoints || 0) : 0;

  const rulePointsSum = (appliedRules || []).reduce((sum, r) => sum + (r.points || 0), 0);

  return baseStudyPoints - penaltyDeduction + rulePointsSum;
}

/**
  * Updates or creates a member's daily submission log entry, recalculates total points,
  * and triggers team score recalculation in Firestore/local state.
  */
export async function updateMemberLogAndRecalculate(
  challengeId: string,
  memberHandle: string,
  targetDateYmd: string,
  hoursStudied: number,
  appliedRules: Array<{ ruleId?: string; ruleName: string; emoji?: string; points: number; type?: string }>,
  uploaderUid: string = 'admin'
): Promise<YptTeam[]> {
  const challenge = await getYptChallenge(challengeId);
  if (!challenge) throw new Error('Challenge not found');

  const cleanHandle = memberHandle.replace(/^@/, '').trim().toLowerCase();
  const calculatedPoints = calculateMemberPointsForDate(hoursStudied, challenge.rules, appliedRules);

  const extractedData: YptExtractedMemberData = {
    yptHandle: cleanHandle,
    hoursStudied: Math.max(0, Number(hoursStudied.toFixed(2))),
    pointsEarned: calculatedPoints,
    morningSnap: false,
    detectedRules: appliedRules.map((r) => ({
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      emoji: r.emoji || (r.type === 'bonus' ? '☀️' : '📱'),
      points: r.points,
    })),
  };

  await addYptSubmissionLog(challengeId, {
    uploaderUid,
    imageUrl: '',
    extractedMembers: [extractedData],
    status: 'verified',
    targetDateYmd,
    dateYmd: targetDateYmd,
    totalPointsAwarded: calculatedPoints,
  });

  return await recalculateTeamPointsFromSubmissions(challengeId);
}

/**
 * Group submissions by (memberHandle, targetDateYmd, challengeId).
 * Takes the latest valid submission log for that day (or higher verified study time for that date).
 */
export function getDeduplicatedDailyMemberStats(
  submissions: YptSubmissionLog[]
): DailyMemberStat[] {
  const dailyMap = new Map<string, DailyMemberStat>();

  const validSubmissions = submissions.filter(
    (s) => s.status === "verified" || s.status === "pending"
  );

  // Sort by timestamp ascending so later submissions take precedence or higher study time is kept
  const sorted = [...validSubmissions].sort((a, b) => {
    const tA = new Date(a.timestamp).getTime() || 0;
    const tB = new Date(b.timestamp).getTime() || 0;
    return tA - tB;
  });

  sorted.forEach((sub) => {
    const dateYmd = sub.targetDateYmd || sub.dateYmd || getLocalYmd(sub.timestamp);
    if (!dateYmd) return;

    (sub.extractedMembers || []).forEach((m) => {
      if (!m.yptHandle) return;
      const cleanHandle = m.yptHandle.replace(/^@/, "").trim().toLowerCase();
      if (!cleanHandle) return;

      const key = `${cleanHandle}_${dateYmd}_${sub.challengeId || "default"}`;
      const existing = dailyMap.get(key);

      const hours = m.hoursStudied || 0;
      const pts = m.pointsEarned || 0;

      if (!existing) {
        dailyMap.set(key, {
          memberHandle: cleanHandle,
          matchedUid: m.matchedUid,
          dateYmd,
          challengeId: sub.challengeId || "",
          hoursStudied: hours,
          pointsEarned: pts,
          detectedRules: m.detectedRules,
          submissionId: sub.id,
          timestamp: sub.timestamp,
        });
      } else {
        // Idempotent replacement: update if the new submission has equal or higher study time
        if (hours >= existing.hoursStudied) {
          dailyMap.set(key, {
            memberHandle: cleanHandle,
            matchedUid: m.matchedUid,
            dateYmd,
            challengeId: sub.challengeId || "",
            hoursStudied: hours,
            pointsEarned: pts,
            detectedRules: m.detectedRules,
            submissionId: sub.id,
            timestamp: sub.timestamp,
          });
        }
      }
    });
  });

  return Array.from(dailyMap.values());
}

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
  await setDoc(challengeRef, newChallenge);
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
  const challenges = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as YptChallenge));
  challenges.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
  return challenges;
}

/**
 * Updates an existing YPT Challenge document.
 */
export async function updateYptChallenge(
  challengeId: string,
  updates: Partial<YptChallenge>
): Promise<void> {
  const docRef = doc(db, CHALLENGES_COLLECTION, challengeId);
  await setDoc(
    docRef,
    {
      ...updates,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Soft-deletes a YPT Challenge from Firestore.
 */
export async function softDeleteYptChallenge(challengeId: string): Promise<void> {
  await updateYptChallenge(challengeId, {
    isDeleted: true,
    status: 'deleted',
    deletedAt: new Date().toISOString(),
  });
}

/**
 * Restores a soft-deleted YPT Challenge in Firestore.
 */
export async function restoreYptChallenge(challengeId: string): Promise<void> {
  await updateYptChallenge(challengeId, {
    isDeleted: false,
    status: 'active',
  });
}

/**
 * Permanently deletes a YPT Challenge from Firestore.
 */
export async function deleteYptChallenge(challengeId: string): Promise<void> {
  const docRef = doc(db, CHALLENGES_COLLECTION, challengeId);
  await deleteDoc(docRef);
}

/**
 * Adds an OCR submission log under yptChallenges/{challengeId}/submissions.
 */
export async function addYptSubmissionLog(
  challengeId: string,
  submissionData: Omit<YptSubmissionLog, "id" | "timestamp" | "challengeId" | "totalPointsAwarded"> & {
    challengeId?: string;
    totalPointsAwarded?: number;
  }
): Promise<string> {
  const subColRef = collection(db, CHALLENGES_COLLECTION, challengeId, "submissions");
  const subDocRef = doc(subColRef);

  const targetDateYmd = submissionData.targetDateYmd || submissionData.dateYmd || getLocalYmd(new Date());
  const calculatedTotalPts = submissionData.totalPointsAwarded ?? (submissionData.extractedMembers || []).reduce((acc, m) => acc + (m.pointsEarned || 0), 0);

  const newSubmission: YptSubmissionLog = {
    ...submissionData,
    id: subDocRef.id,
    challengeId,
    totalPointsAwarded: calculatedTotalPts,
    dateYmd: targetDateYmd,
    targetDateYmd,
    timestamp: new Date().toISOString(),
  };

  await setDoc(subDocRef, newSubmission);

  // Auto update team points upon adding submission
  await recalculateTeamPointsFromSubmissions(challengeId);

  return subDocRef.id;
}

/**
 * Fetches all submission logs for a specific YPT Challenge.
 */
export async function getYptSubmissionLogs(
  challengeId: string
): Promise<YptSubmissionLog[]> {
  const subColRef = collection(db, CHALLENGES_COLLECTION, challengeId, "submissions");
  const q = query(subColRef, orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => {
    const data = docSnap.data() as YptSubmissionLog;
    const targetDateYmd = data.targetDateYmd || data.dateYmd || getLocalYmd(data.timestamp);
    return {
      ...data,
      id: docSnap.id,
      challengeId: data.challengeId || challengeId,
      dateYmd: targetDateYmd,
      targetDateYmd,
    };
  });
}

/**
 * Updates submission status (verified / rejected).
 */
export async function updateYptSubmissionStatus(
  challengeId: string,
  submissionId: string,
  status: "verified" | "rejected"
): Promise<void> {
  const subDocRef = doc(db, CHALLENGES_COLLECTION, challengeId, "submissions", submissionId);
  await updateDoc(subDocRef, { status });
  await recalculateTeamPointsFromSubmissions(challengeId);
}

/**
 * Recalculates points for each team in the challenge based on verified submissions,
 * using same-day replacement/deduplication per member.
 */
export async function recalculateTeamPointsFromSubmissions(
  challengeId: string
): Promise<YptTeam[]> {
  const challenge = await getYptChallenge(challengeId);
  if (!challenge) return [];

  const submissions = await getYptSubmissionLogs(challengeId);
  const deduplicatedStats = getDeduplicatedDailyMemberStats(submissions);

  // Map clean handle / UID -> accumulated total points across distinct days
  const handlePointsMap = new Map<string, number>();

  deduplicatedStats.forEach((stat) => {
    const pts = stat.pointsEarned || 0;
    if (stat.memberHandle) {
      handlePointsMap.set(
        stat.memberHandle,
        (handlePointsMap.get(stat.memberHandle) || 0) + pts
      );
    }
    if (stat.matchedUid) {
      const cleanUid = stat.matchedUid.replace(/^@/, '').trim().toLowerCase();
      handlePointsMap.set(
        cleanUid,
        (handlePointsMap.get(cleanUid) || 0) + pts
      );
    }
  });

  // Calculate team point totals
  const updatedTeams: YptTeam[] = challenge.teams.map((team) => {
    let teamTotal = 0;
    (team.memberUids || []).forEach((handleOrUid) => {
      const clean = handleOrUid.replace(/^@/, '').trim().toLowerCase();
      teamTotal += handlePointsMap.get(clean) || 0;
    });
    return {
      ...team,
      totalPoints: teamTotal,
    };
  });

  await updateYptChallenge(challengeId, { teams: updatedTeams });
  return updatedTeams;
}

/**
 * Retrieves all known YPT handles across user profiles and existing challenges.
 */
export async function getAllKnownYptNames(): Promise<string[]> {
  const namesSet = new Set<string>();

  try {
    const usersCol = collection(db, 'users');
    const usersSnap = await getDocs(usersCol);
    usersSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (Array.isArray(data.yptNames)) {
        data.yptNames.forEach((n: string) => {
          if (n && typeof n === 'string' && n.trim()) {
            namesSet.add(n.trim());
          }
        });
      }
    });
  } catch (err) {
    console.warn('Could not fetch user profiles for YPT names:', err);
  }

  try {
    const challengesCol = collection(db, CHALLENGES_COLLECTION);
    const challengesSnap = await getDocs(challengesCol);
    challengesSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() as YptChallenge;
      if (Array.isArray(data.teams)) {
        data.teams.forEach((team) => {
          if (Array.isArray(team.memberUids)) {
            team.memberUids.forEach((m) => {
              if (m && typeof m === 'string' && m.trim()) {
                namesSet.add(m.trim());
              }
            });
          }
        });
      }
    });
  } catch (err) {
    console.warn('Could not fetch challenges for YPT names:', err);
  }

  return Array.from(namesSet);
}

export interface YptUserEntry {
  uid: string;
  displayName?: string;
  yptNames: string[];
  defaultYptHandle?: string;
}

export function normalizeHandle(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/^@/, '')
    .normalize('NFKC')
    .replace(/[\uFE00-\uFE0F\u200B-\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function extractAlpha(str: string): string {
  if (!str) return '';
  return normalizeHandle(str).replace(/[^a-z0-9]/g, '');
}

export function matchYptHandleToUid(
  handle: string,
  users: YptUserEntry[]
): string | undefined {
  if (!handle || !users || users.length === 0) return undefined;

  const rawTarget = handle.trim().toLowerCase();
  const cleanTarget = normalizeHandle(handle);
  const alphaTarget = extractAlpha(handle);

  // Pass 1: Exact raw match
  for (const user of users) {
    const allNames = [...(user.yptNames || [])];
    if (user.displayName) allNames.push(user.displayName);

    for (const name of allNames) {
      if (!name) continue;
      if (name.trim().toLowerCase() === rawTarget) {
        return user.uid;
      }
    }
  }

  // Pass 2: Clean normalized match (stripping @, variation selectors, extra spaces)
  for (const user of users) {
    const allNames = [...(user.yptNames || [])];
    if (user.displayName) allNames.push(user.displayName);

    for (const name of allNames) {
      if (!name) continue;
      if (normalizeHandle(name) === cleanTarget) {
        return user.uid;
      }
    }
  }

  // Pass 3: Alphanumeric base match
  if (alphaTarget.length >= 2) {
    for (const user of users) {
      const allNames = [...(user.yptNames || [])];
      if (user.displayName) allNames.push(user.displayName);

      for (const name of allNames) {
        if (!name) continue;
        const nameAlpha = extractAlpha(name);
        if (nameAlpha.length >= 2 && nameAlpha === alphaTarget) {
          return user.uid;
        }
      }
    }
  }

  // Pass 4: Substring / Sub-word match
  if (alphaTarget.length >= 3) {
    for (const user of users) {
      const allNames = [...(user.yptNames || [])];
      if (user.displayName) allNames.push(user.displayName);

      for (const name of allNames) {
        if (!name) continue;
        const nameAlpha = extractAlpha(name);
        if (nameAlpha.length >= 3 && (alphaTarget.includes(nameAlpha) || nameAlpha.includes(alphaTarget))) {
          return user.uid;
        }
      }
    }
  }

  return undefined;
}

export async function getRegisteredUserYptList(): Promise<YptUserEntry[]> {
  const users: YptUserEntry[] = [];
  try {
    const usersCol = collection(db, 'users');
    const usersSnap = await getDocs(usersCol);
    usersSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const names = new Set<string>();
      if (Array.isArray(data.yptNames) && data.yptNames.length > 0) {
        data.yptNames.forEach((n: string) => {
          if (n && typeof n === 'string' && n.trim()) {
            names.add(n.trim());
          }
        });
      } else if (typeof data.yptName === 'string' && data.yptName.trim()) {
        names.add(data.yptName.trim());
      }
      const defaultHandle = typeof data.defaultYptHandle === 'string' && data.defaultYptHandle.trim()
        ? data.defaultYptHandle.trim()
        : undefined;

      if (names.size > 0) {
        users.push({
          uid: docSnap.id,
          displayName: data.displayName,
          yptNames: Array.from(names),
          defaultYptHandle: defaultHandle,
        });
      }
    });
  } catch (err) {
    console.warn('Could not fetch user profiles for YPT list:', err);
  }
  return users;
}

