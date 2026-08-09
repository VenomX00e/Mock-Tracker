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
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { YptChallenge, YptCustomRule, YptExtractedMemberData, YptSubmissionLog, YptTeam } from "../types/yptTypes";
import { getLocalYmd, areYptHandlesMatching, normalizeHandle, extractAlpha } from "../utils/yptUtils";

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

/**
 * Evaluates whether a custom point rule condition matches based on detected emojis, study hours, and morning snap status.
 */
export function evaluatePointRule(
  rule: YptCustomRule,
  detectedEmojis: string[] = [],
  hoursStudied: number = 0,
  hasSnap: boolean = false
): boolean {
  if (!rule || !rule.name) return false;

  const ruleEmoji = rule.emoji ? String(rule.emoji).trim() : '';
  const nameLower = rule.name.toLowerCase();

  const emojiMatched =
    Boolean(ruleEmoji && detectedEmojis.some((e) => e.includes(ruleEmoji) || ruleEmoji.includes(e))) ||
    Boolean(hasSnap && (nameLower.includes('snap') || ruleEmoji === '☀️'));

  const minHours = rule.minHoursNeeded ?? 0;
  const hoursMatched = hoursStudied >= minHours;

  const condition = rule.conditionType || 'emoji_only';

  switch (condition) {
    case 'hours_only':
      return hoursMatched;
    case 'both':
      return emojiMatched && hoursMatched;
    case 'either':
      return emojiMatched || hoursMatched;
    case 'emoji_only':
    default:
      return emojiMatched;
  }
}

/**
 * Calculates base points, penalties, and custom rule evaluations for a member's daily study record.
 */
export function calculatePointsFromRules(
  hoursStudied: number,
  rules: YptChallenge['rules'],
  detectedEmojis: string[] = [],
  hasSnap: boolean = false
): { totalPoints: number; appliedRules: Array<{ ruleId?: string; ruleName: string; emoji: string; points: number }> } {
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

  const appliedRules: Array<{ ruleId?: string; ruleName: string; emoji: string; points: number }> = [];
  let customRulePointsSum = 0;

  if (Array.isArray(rules.customRules)) {
    for (const cr of rules.customRules) {
      if (evaluatePointRule(cr, detectedEmojis, hoursStudied, hasSnap)) {
        const p = Number(cr.points) || 0;
        const awardedPts = cr.type === 'bonus' ? p : -p;
        const isTeamAll = cr.scope === 'team_all';
        const effectivePts = isTeamAll ? 0 : awardedPts;

        customRulePointsSum += effectivePts;

        appliedRules.push({
          ruleId: cr.id,
          ruleName: cr.name,
          emoji: cr.emoji || (cr.type === 'bonus' ? '☀️' : '📱'),
          points: effectivePts,
        });
      }
    }
  }

  const totalPoints = baseStudyPoints - penaltyDeduction + customRulePointsSum;

  return { totalPoints, appliedRules };
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
 * Evaluates team-wide (team_all) custom rules for a set of daily stats against a challenge's team structure.
 * Awards bonus/penalty points ONLY if 100% of registered team members fulfilled the rule on that date.
 */
export function evaluateAndApplyTeamWideRules(
  stats: DailyMemberStat[],
  challenge?: YptChallenge
): DailyMemberStat[] {
  if (!challenge || !challenge.rules || !Array.isArray(challenge.rules.customRules)) {
    return stats;
  }

  const teamWideRules = challenge.rules.customRules.filter((r) => r.scope === 'team_all');
  if (teamWideRules.length === 0) {
    return stats;
  }

  const teams = challenge.teams || [];
  if (teams.length === 0) {
    return stats;
  }

  const updatedStats: DailyMemberStat[] = stats.map((s) => ({
    ...s,
    detectedRules: s.detectedRules ? s.detectedRules.map((r) => ({ ...r })) : [],
  }));

  const allDates = Array.from(new Set(updatedStats.map((s) => s.dateYmd))).filter(Boolean);

  allDates.forEach((dateYmd) => {
    teams.forEach((team) => {
      const teamMemberHandles = team.memberUids || [];
      if (teamMemberHandles.length === 0) return;

      teamWideRules.forEach((rule) => {
        const pointsVal = Number(rule.points) || 0;
        const awardedPoints = rule.type === 'bonus' ? pointsVal : -pointsVal;

        const memberStatsForDate = teamMemberHandles.map((handleOrUid) => {
          const found = updatedStats.find(
            (s) => s.dateYmd === dateYmd && areYptHandlesMatching(s.memberHandle, handleOrUid, s.matchedUid)
          );
          return { handleOrUid, stat: found };
        });

        // 100% compliance check: ALL registered team members must have submitted a log on dateYmd AND triggered the rule
        const allSubmitted = memberStatsForDate.every((item) => item.stat !== undefined);
        let allMetRule = false;

        if (allSubmitted) {
          allMetRule = memberStatsForDate.every((item) => {
            const st = item.stat;
            if (!st) return false;
            const hasRuleDetected = (st.detectedRules || []).some(
              (r) => r.ruleId === rule.id || r.ruleName === rule.name || (rule.emoji && r.emoji === rule.emoji)
            );
            if (hasRuleDetected) return true;

            const emojis = (st.detectedRules || []).map((r) => r.emoji).filter((e): e is string => Boolean(e));
            return evaluatePointRule(rule, emojis, st.hoursStudied, false);
          });
        }

        // Apply bonus or penalty to all team members if 100% compliant; otherwise reset/strip team_all points
        memberStatsForDate.forEach((item) => {
          if (!item.stat) return;
          const st = item.stat;
          st.detectedRules = st.detectedRules || [];

          const existingRuleIdx = st.detectedRules.findIndex(
            (r) => r.ruleId === rule.id || r.ruleName === rule.name || (rule.emoji && r.emoji === rule.emoji)
          );

          if (allMetRule) {
            if (existingRuleIdx >= 0) {
              const currentPts = st.detectedRules[existingRuleIdx].points || 0;
              if (currentPts !== awardedPoints) {
                st.pointsEarned = (st.pointsEarned || 0) - currentPts + awardedPoints;
                st.detectedRules[existingRuleIdx].points = awardedPoints;
              }
            } else {
              st.detectedRules.push({
                ruleId: rule.id,
                ruleName: rule.name,
                emoji: rule.emoji || (rule.type === 'bonus' ? '☀️' : '📱'),
                points: awardedPoints,
              });
              st.pointsEarned = (st.pointsEarned || 0) + awardedPoints;
            }
          } else {
            if (existingRuleIdx >= 0) {
              const currentPts = st.detectedRules[existingRuleIdx].points || 0;
              if (currentPts !== 0) {
                st.pointsEarned = (st.pointsEarned || 0) - currentPts;
                st.detectedRules[existingRuleIdx].points = 0;
              }
            }
          }
        });
      });
    });
  });

  return updatedStats;
}

/**
 * Group submissions by (memberHandle, targetDateYmd, challengeId).
 * Takes the latest valid submission log for that day (or higher verified study time for that date).
 */
export function getDeduplicatedDailyMemberStats(
  submissions: YptSubmissionLog[],
  challenge?: YptChallenge
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

  const rawStats = Array.from(dailyMap.values());
  return evaluateAndApplyTeamWideRules(rawStats, challenge);
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
 * Real-time listener for all YPT Challenges.
 */
export function subscribeToYptChallenges(
  callback: (challenges: YptChallenge[]) => void
): () => void {
  const colRef = collection(db, CHALLENGES_COLLECTION);
  
  return onSnapshot(
    colRef,
    (snap) => {
      const challenges = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as YptChallenge))
        .filter((c) => !c.isDeleted);
      challenges.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      callback(challenges);
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
 * Real-time listener for submission logs of a specific YPT Challenge.
 */
export function subscribeToSubmissionLogs(
  challengeId: string,
  callback: (logs: YptSubmissionLog[]) => void
): () => void {
  const subColRef = collection(db, CHALLENGES_COLLECTION, challengeId, "submissions");
  const q = query(subColRef, orderBy("timestamp", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs.map((docSnap) => {
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
      callback(logs);
    },
    (err) => {
      console.warn("Error listening to submission logs:", err);
    }
  );
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

  // Calculate team point totals using robust multi-tier handle matching
  const updatedTeams: YptTeam[] = challenge.teams.map((team) => {
    let teamTotal = 0;
    (team.memberUids || []).forEach((handleOrUid) => {
      let memberPts = 0;
      deduplicatedStats.forEach((stat) => {
        if (areYptHandlesMatching(stat.memberHandle, handleOrUid, stat.matchedUid)) {
          memberPts += stat.pointsEarned || 0;
        }
      });
      teamTotal += memberPts;
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

export { normalizeHandle, extractAlpha };

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

/**
  * Executes a bulk batch mutation for member daily logs in Firestore.
  */
export async function batchUpdateMemberLogs(
  challengeId: string,
  updates: Array<{ memberHandle: string; dateYmd: string; hours: number; points: number }>
): Promise<void> {
  if (!updates || updates.length === 0) return;

  const batch = writeBatch(db);

  updates.forEach((update) => {
    const logRef = doc(collection(db, CHALLENGES_COLLECTION, challengeId, "submissions"));
    batch.set(logRef, {
      challengeId,
      dateYmd: update.dateYmd,
      targetDateYmd: update.dateYmd,
      extractedMembers: [{
        yptHandle: update.memberHandle,
        hoursStudied: update.hours,
        pointsEarned: update.points,
      }],
      status: 'verified',
      timestamp: new Date().toISOString(),
      rawOcrText: 'Admin Manual Batch Entry',
      submittedByUid: 'admin_batch',
    });
  });

  // Executes all writes in a single batch request
  await batch.commit();
}

/**
 * Clears all submission logs for a specific challenge and date (targetDateYmd),
 * returning the removed logs so they can be restored via Undo/Redo.
 */
export async function clearYptDayPoints(
  challengeId: string,
  selectedDateYmd: string
): Promise<YptSubmissionLog[]> {
  return clearDaySubmissions(challengeId, selectedDateYmd);
}

export async function clearDaySubmissions(
  challengeId: string,
  targetDateYmd: string
): Promise<YptSubmissionLog[]> {
  const subColRef = collection(db, CHALLENGES_COLLECTION, challengeId, "submissions");
  const snap = await getDocs(subColRef);

  const clearedLogs: YptSubmissionLog[] = [];
  const batch = writeBatch(db);

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() as YptSubmissionLog;
    const subDate = data.targetDateYmd || data.dateYmd || getLocalYmd(data.timestamp);
    if (subDate === targetDateYmd) {
      clearedLogs.push({ ...data, id: docSnap.id });
      batch.delete(docSnap.ref);
    }
  });

  if (clearedLogs.length > 0) {
    await batch.commit();
  }

  await recalculateTeamPointsFromSubmissions(challengeId);
  return clearedLogs;
}

/**
 * Restores a collection of submission logs into Firestore and recalculates team scores.
 */
export async function restoreDaySubmissions(
  challengeId: string,
  logsToRestore: YptSubmissionLog[]
): Promise<void> {
  if (!logsToRestore || logsToRestore.length === 0) return;

  const batch = writeBatch(db);
  logsToRestore.forEach((log) => {
    const subDocRef = doc(db, CHALLENGES_COLLECTION, challengeId, "submissions", log.id);
    batch.set(subDocRef, log);
  });

  await batch.commit();
  await recalculateTeamPointsFromSubmissions(challengeId);
}

