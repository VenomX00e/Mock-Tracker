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
import { db, auth } from "./firebase";
import { YptChallenge, YptCustomRule, YptExtractedMemberData, YptSubmissionLog, YptTeam, YptApiGroup, YptApiMember, YptApiNativeChallenge, YptDailyDaySnapshot } from "../types/yptTypes";
import {
  getLocalYmd,
  getYptDayYmd,
  getYesterdayYptDayYmd,
  applyHighWaterMark,
  isYptReconciliationWindow,
  getIstDate,
  areYptHandlesMatching,
  normalizeHandle,
  extractAlpha,
  getChallengeStartDateYmd,
  getChallengeEndDateYmd,
  getMemberStudyHoursFromApi,
} from "../utils/yptUtils";
import { useYptStore } from "../store/useYptStore";

const CHALLENGES_COLLECTION = "yptChallenges";

export function getYptStoredCredentials() {
  const email = localStorage.getItem("ypt_email") || "";
  const password = localStorage.getItem("ypt_password") || "";
  const token = localStorage.getItem("ypt_token") || "";
  return { email, password, token };
}

export function saveYptCredentials(email: string, password?: string, token?: string) {
  if (email !== undefined) localStorage.setItem("ypt_email", email.trim());
  if (password !== undefined) localStorage.setItem("ypt_password", password);
  if (token !== undefined) localStorage.setItem("ypt_token", token.trim());
}

export function clearYptCredentials() {
  localStorage.removeItem("ypt_email");
  localStorage.removeItem("ypt_password");
  localStorage.removeItem("ypt_token");
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  const headers: Record<string, string> = {};
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }

  const { email, password, token: yptToken } = getYptStoredCredentials();
  if (email) headers["x-ypt-email"] = email;
  if (password) headers["x-ypt-password"] = password;
  if (yptToken) headers["x-ypt-token"] = yptToken;

  return headers;
}

/**
 * Fetches joined YPT groups from the server proxy (/api/ypt/live-sync?action=get-groups).
 */
export async function fetchYptGroups(customCreds?: { email?: string; password?: string; token?: string }): Promise<{ groups: YptApiGroup[]; isDemo?: boolean; message?: string }> {
  const headers = await getAuthHeader();
  if (customCreds?.email) headers["x-ypt-email"] = customCreds.email;
  if (customCreds?.password) headers["x-ypt-password"] = customCreds.password;
  if (customCreds?.token) headers["x-ypt-token"] = customCreds.token;

  const res = await fetch("/api/ypt/live-sync?action=get-groups", { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch YPT groups (${res.status})`);
  }
  const data = await res.json();
  return {
    groups: data.groups || [],
    isDemo: data.isDemo,
    message: data.message,
  };
}

/**
 * Fetches member rosters, study logs, and native challenge states from the server proxy.
 */
export async function fetchYptRoster(groupIds?: (number | string)[]): Promise<{
  roster: YptApiMember[];
  groups: YptApiGroup[];
  nativeChallenges: YptApiNativeChallenge[];
}> {
  const headers = await getAuthHeader();
  const gidsParam = Array.isArray(groupIds) && groupIds.length > 0 ? `&groupIds=${groupIds.join(",")}` : "";
  const res = await fetch(`/api/ypt/live-sync?action=get-roster${gidsParam}`, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch YPT roster (${res.status})`);
  }
  const data = await res.json();
  return {
    roster: data.roster || data.members || [],
    groups: data.groups || [],
    nativeChallenges: data.nativeChallenges || [],
  };
}

export interface YptDayLogSubject {
  id: number | string;
  name: string;
  sm: number;
  hours: number;
  color?: string;
}

export interface YptDayLogResponse {
  date: string;
  totalMs: number;
  studyHours: number;
  subjects: YptDayLogSubject[];
  isDemo?: boolean;
  raw?: any;
  error?: string;
}

/**
 * Fetches real historical study logs from YPT for a given date (YYYY-MM-DD) via GET /logs/day?date=YYYY-MM-DD.
 */
export async function fetchYptDayLog(
  dateYmd: string,
  customCreds?: { email?: string; password?: string; token?: string }
): Promise<YptDayLogResponse> {
  const headers = await getAuthHeader();
  if (customCreds?.email) headers["x-ypt-email"] = customCreds.email;
  if (customCreds?.password) headers["x-ypt-password"] = customCreds.password;
  if (customCreds?.token) headers["x-ypt-token"] = customCreds.token;

  const res = await fetch(`/api/ypt/live-sync?action=get-day-log&date=${encodeURIComponent(dateYmd)}`, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch YPT day log (${res.status})`);
  }
  const data = await res.json();
  return {
    date: data.date || dateYmd,
    totalMs: data.totalMs || 0,
    studyHours: data.studyHours || 0,
    subjects: data.subjects || [],
    isDemo: data.isDemo,
    raw: data.raw,
    error: data.error,
  };
}

/**
 * Fetches historical study logs from YPT for multiple dates in batch.
 */
export async function fetchYptDayLogs(
  dateYmds: string[],
  customCreds?: { email?: string; password?: string; token?: string }
): Promise<YptDayLogResponse[]> {
  if (!dateYmds || dateYmds.length === 0) return [];
  const headers = await getAuthHeader();
  if (customCreds?.email) headers["x-ypt-email"] = customCreds.email;
  if (customCreds?.password) headers["x-ypt-password"] = customCreds.password;
  if (customCreds?.token) headers["x-ypt-token"] = customCreds.token;

  const datesParam = dateYmds.join(",");
  const res = await fetch(`/api/ypt/live-sync?action=get-day-logs&dates=${encodeURIComponent(datesParam)}`, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch YPT day logs (${res.status})`);
  }
  const data = await res.json();
  return (data.dayLogs || []).map((d: any) => ({
    date: d.date,
    totalMs: d.totalMs || 0,
    studyHours: d.studyHours || 0,
    subjects: d.subjects || [],
    isDemo: d.isDemo,
    raw: d.raw,
    error: d.error,
  }));
}

/**
 * Binds a user's Firebase account to their permanent YPT User ID (yptUd) in Firestore.
 */
export async function claimYptIdentity(
  appUserId: string,
  yptUd: number,
  yptHandle: string
): Promise<void> {
  const userRef = doc(db, "users", appUserId);
  const userSnap = await getDoc(userRef);

  let existingNames: string[] = [];
  if (userSnap.exists()) {
    const data = userSnap.data();
    if (Array.isArray(data.yptNames)) existingNames = data.yptNames;
    else if (data.yptName) existingNames = [data.yptName];
  }

  const cleanHandle = yptHandle.trim();
  const updatedNames = Array.from(new Set([...existingNames, cleanHandle]));

  await setDoc(
    userRef,
    {
      yptUd,
      yptName: cleanHandle,
      yptNames: updatedNames,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Matches YPT roster members against registered Firebase users in Firestore using yptUd first,
 * falling back to handle matching.
 */
export async function linkYptRosterToAppUsers(rosterMembers: YptApiMember[]): Promise<
  Array<{
    yptMember: YptApiMember;
    appUserId?: string;
    matchedHandle: string;
  }>
> {
  const usersRef = collection(db, "users");
  const usersSnap = await getDocs(usersRef);

  const appUsers: Array<{
    uid: string;
    yptUd?: number;
    displayName?: string;
    yptNames: string[];
  }> = [];

  usersSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const names = new Set<string>();
    if (Array.isArray(data.yptNames)) {
      data.yptNames.forEach((n: string) => n && names.add(String(n).trim()));
    }
    if (data.yptName) names.add(String(data.yptName).trim());
    if (data.displayName) names.add(String(data.displayName).trim());

    appUsers.push({
      uid: docSnap.id,
      yptUd: typeof data.yptUd === "number" ? data.yptUd : undefined,
      displayName: data.displayName,
      yptNames: Array.from(names),
    });
  });

  return rosterMembers.map((member) => {
    let matchedUser = appUsers.find((u) => u.yptUd === member.ud);

    if (!matchedUser) {
      const handleLower = member.n.toLowerCase().trim();
      matchedUser = appUsers.find((u) =>
        u.yptNames.some((name) => name.toLowerCase().trim() === handleLower)
      );
    }

    return {
      yptMember: member,
      appUserId: matchedUser?.uid,
      matchedHandle: matchedUser?.displayName || member.n,
    };
  });
}

export interface DailyMemberStat {
  memberHandle: string;
  matchedUid?: string;
  dateYmd: string;
  challengeId: string;
  hoursStudied: number;
  maxContinuousMs?: number;
  isStudyingCurrently?: boolean;
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
 * Evaluates whether a custom point rule condition matches based on detected emojis, completed native YPT challenges, study hours, and morning snap status.
 */
export function evaluatePointRule(
  rule: YptCustomRule,
  detectedEmojis: string[] = [],
  hoursStudied: number = 0,
  hasSnap: boolean = false,
  completedNativeChallengeIds: number[] = []
): boolean {
  if (!rule || !rule.name) return false;

  const ruleEmoji = rule.emoji ? String(rule.emoji).trim() : '';
  const nameLower = rule.name.toLowerCase();

  const isNativeChallengeCompleted =
    Boolean(
      rule.nativeChallengeId &&
      (completedNativeChallengeIds.includes(Number(rule.nativeChallengeId)) ||
       completedNativeChallengeIds.map(String).includes(String(rule.nativeChallengeId)))
    );

  const emojiMatched =
    isNativeChallengeCompleted ||
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
 * @param applyPenalty Set to false during active open live day to avoid premature penalties while studying.
 * @param maxContinuousMs Maximum continuous study session duration in milliseconds (dl.mm).
 */
export function calculatePointsFromRules(
  hoursStudied: number,
  rules: YptChallenge['rules'],
  detectedEmojis: string[] = [],
  hasSnap: boolean = false,
  completedNativeChallengeIds: number[] = [],
  applyPenalty: boolean = true,
  maxContinuousMs: number = 0
): { totalPoints: number; appliedRules: Array<{ ruleId?: string; ruleName: string; emoji: string; points: number }> } {
  const intervalVal = rules?.studyIntervalValue ?? 1;
  const intervalUnit = rules?.studyIntervalUnit ?? 'hours';
  const intervalHours = intervalUnit === 'minutes' ? intervalVal / 60 : intervalVal || 1;
  const ptsPerInterval = rules?.pointsPerInterval ?? rules?.pointsPerStudyHour ?? 1;

  const baseStudyPoints = Math.floor(hoursStudied / (intervalHours || 1)) * ptsPerInterval;

  const penaltyThresholdVal = rules?.penaltyThresholdValue ?? rules?.noStudyPenaltyThresholdHours ?? 3;
  const penaltyThresholdUnit = rules?.penaltyThresholdUnit ?? 'hours';
  const penaltyThresholdHours = penaltyThresholdUnit === 'minutes' ? penaltyThresholdVal / 60 : penaltyThresholdVal || 3;

  // The Penalty Gatekeeper: apply penalty ONLY if applyPenalty is true AND hoursStudied < threshold
  const isPenalized = applyPenalty && hoursStudied < penaltyThresholdHours;
  const penaltyDeduction = isPenalized ? (rules?.penaltyPoints || 0) : 0;

  const appliedRules: Array<{ ruleId?: string; ruleName: string; emoji: string; points: number }> = [];
  let customRulePointsSum = 0;

  if (Array.isArray(rules?.customRules)) {
    for (const cr of rules.customRules) {
      if (evaluatePointRule(cr, detectedEmojis, hoursStudied, hasSnap, completedNativeChallengeIds)) {
        const p = Number(cr.points) || 0;
        const awardedPts = cr.type === 'bonus' ? p : -p;
        const isTeamAll = cr.scope === 'team_all';
        const effectivePts = isTeamAll ? 0 : awardedPts;

        // Custom penalties should also respect the applyPenalty gatekeeper
        if (effectivePts < 0 && !applyPenalty) {
          continue;
        }

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

  if (isPenalized && (rules?.penaltyPoints || 0) > 0) {
    appliedRules.push({
      ruleId: 'no_study_penalty',
      ruleName: 'No Study Penalty',
      emoji: '⚠️',
      points: -(rules?.penaltyPoints || 0),
    });
  }

  // Evaluate the Fake Session / Max Continuous Trap
  let maxContinuousPenaltyDeduction = 0;
  const maxContThreshold = rules?.maxContinuousHoursThreshold;
  if (typeof maxContThreshold === 'number' && maxContThreshold > 0 && maxContinuousMs > 0) {
    const maxContHours = maxContinuousMs / 3600000;
    if (maxContHours > maxContThreshold) {
      const penaltyType = rules?.maxContinuousPenaltyType || 'variable';

      if (penaltyType === 'fixed') {
        const fixedDeduction = typeof rules?.maxContinuousFixedPenalty === 'number' ? rules.maxContinuousFixedPenalty : 0;
        if (fixedDeduction > 0) {
          maxContinuousPenaltyDeduction = fixedDeduction;
          appliedRules.push({
            ruleId: 'max_continuous_fake_session_penalty',
            ruleName: `Fake Session Penalty (>${maxContThreshold}hrs - Flat Deduction)`,
            emoji: '🚨',
            points: -fixedDeduction,
          });
        }
      } else {
        const mode = rules?.maxContinuousPenaltyMode || 'excess';
        const targetHours = mode === 'whole' ? maxContHours : maxContHours - maxContThreshold;

        if (targetHours > 0) {
          const multiplier = rules?.maxContinuousPenaltyMultiplier ?? 1;
          const baseTargetPoints = Math.floor(targetHours / (intervalHours || 1)) * ptsPerInterval;
          const calculatedPenalty = Math.max(0, baseTargetPoints * multiplier);

          if (calculatedPenalty > 0) {
            maxContinuousPenaltyDeduction = calculatedPenalty;
            appliedRules.push({
              ruleId: 'max_continuous_fake_session_penalty',
              ruleName: `Fake Session Penalty (>${maxContThreshold}hrs)`,
              emoji: '🚨',
              points: -calculatedPenalty,
            });
          }
        }
      }
    }
  }

  const totalPoints = baseStudyPoints - penaltyDeduction + customRulePointsSum - maxContinuousPenaltyDeduction;

  return { totalPoints, appliedRules };
}

export function calculateMemberPointsForDate(
  hoursStudied: number,
  rules: YptChallenge['rules'],
  appliedRules?: Array<{ points?: number }>,
  applyPenalty: boolean = true
): number {
  const intervalVal = rules?.studyIntervalValue ?? 1;
  const intervalUnit = rules?.studyIntervalUnit ?? 'hours';
  const intervalHours = intervalUnit === 'minutes' ? intervalVal / 60 : intervalVal || 1;
  const ptsPerInterval = rules?.pointsPerInterval ?? rules?.pointsPerStudyHour ?? 1;

  const baseStudyPoints = Math.floor(hoursStudied / (intervalHours || 1)) * ptsPerInterval;

  const penaltyThresholdVal = rules?.penaltyThresholdValue ?? rules?.noStudyPenaltyThresholdHours ?? 3;
  const penaltyThresholdUnit = rules?.penaltyThresholdUnit ?? 'hours';
  const penaltyThresholdHours = penaltyThresholdUnit === 'minutes' ? penaltyThresholdVal / 60 : penaltyThresholdVal || 3;

  const isPenalized = applyPenalty && hoursStudied < penaltyThresholdHours;
  const penaltyDeduction = isPenalized ? (rules?.penaltyPoints || 0) : 0;

  const rulePointsSum = (appliedRules || []).reduce((sum, r) => {
    const pts = r.points || 0;
    if (pts < 0 && !applyPenalty) return sum;
    return sum + pts;
  }, 0);

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
  const isPastLockedDate = targetDateYmd < getYptDayYmd();
  const applyPenalty = isPastLockedDate;
  const calculatedPoints = calculateMemberPointsForDate(hoursStudied, challenge.rules, appliedRules, applyPenalty);

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
      const maxContinuousMs = m.maxContinuousMs || 0;
      const isStudyingCurrently = m.isStudyingCurrently || false;

      if (!existing) {
        dailyMap.set(key, {
          memberHandle: cleanHandle,
          matchedUid: m.matchedUid,
          dateYmd,
          challengeId: sub.challengeId || "",
          hoursStudied: hours,
          maxContinuousMs,
          isStudyingCurrently,
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
            maxContinuousMs: Math.max(existing.maxContinuousMs || 0, maxContinuousMs),
            isStudyingCurrently,
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

export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof obj === "object" && !(obj instanceof Date) && !(obj instanceof Timestamp)) {
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        newObj[key] = sanitizeForFirestore(value);
      }
    }
    return newObj;
  }
  return obj;
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

  // Optimistically update Zustand store (0ms UI latency)
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
  const challenges = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as YptChallenge));
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
    docChanges?: { type: 'added' | 'modified' | 'removed'; item: YptChallenge }[],
    metadata?: { hasPendingWrites: boolean; fromCache: boolean }
  ) => void
): () => void {
  const colRef = collection(db, CHALLENGES_COLLECTION);
  
  return onSnapshot(
    colRef,
    (snap) => {
      const challenges = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as YptChallenge));
      challenges.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      const changes = snap.docChanges().map((change) => ({
        type: change.type as 'added' | 'modified' | 'removed',
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
  // Optimistically update Zustand store (0ms UI latency)
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
export async function softDeleteYptChallenge(challengeId: string): Promise<void> {
  await updateYptChallenge(challengeId, {
    isDeleted: true,
    status: 'deleted',
    deletedAt: new Date().toISOString(),
  });
}

export interface YptChallengeWinnerSummary {
  mode: 'team' | 'individual';
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
 * all daily snapshots and submission logs.
 * - Team Mode: Calculates the team with the most points (tie-breaker: hours) -> sets winningTeamId.
 * - Individual Mode: Sorts final accumulated points of all participants -> sets winningParticipantUd & winningParticipantHandle.
 * - Finds overall tournament MVP (member with the highest cumulative study hours).
 */
export async function resolveChallengeWinners(
  challengeIdOrChallenge: string | YptChallenge
): Promise<YptChallengeWinnerSummary> {
  const challenge: YptChallenge | null =
    typeof challengeIdOrChallenge === 'string'
      ? await getYptChallenge(challengeIdOrChallenge)
      : challengeIdOrChallenge;

  if (!challenge) {
    throw new Error(`Challenge not found: ${challengeIdOrChallenge}`);
  }

  const isSoloMode = (challenge.mode || 'team') === 'individual';
  const todayStr = getYptDayYmd();

  const [submissions, dailySnapshots] = await Promise.all([
    getYptSubmissionLogs(challenge.id),
    getAllDailySnapshots(challenge.id),
  ]);

  const deduplicatedStats = getDeduplicatedDailyMemberStats(submissions, challenge);

  // Set of dates covered by finalized daily snapshots
  const closedSnapshotDates = new Set(
    dailySnapshots
      .filter((s) => s.targetDateYmd < todayStr)
      .map((s) => s.targetDateYmd || s.dateYmd)
  );

  // Deduplicated submission stats not covered by closed snapshots (e.g. today or unclosed)
  const unclosedStats = deduplicatedStats.filter(
    (stat) => !closedSnapshotDates.has(stat.dateYmd)
  );

  let grandTotalHours = 0;

  if (isSoloMode) {
    // Accumulator map for every participant: key = clean handle or yptUd
    const participantMap = new Map<string, {
      yptUd?: number;
      yptHandle: string;
      appUserId?: string;
      totalPoints: number;
      totalHours: number;
    }>();

    // Initialize from challenge.participants if provided
    (challenge.participants || []).forEach((p) => {
      const cleanKey = (p.yptHandle || '').replace(/^@/, '').trim().toLowerCase();
      if (!cleanKey && !p.yptUd) return;
      participantMap.set(cleanKey || String(p.yptUd), {
        yptUd: p.yptUd,
        yptHandle: p.yptHandle || cleanKey,
        appUserId: p.appUserId,
        totalPoints: 0,
        totalHours: 0,
      });
    });

    // Helper to find or add entry in participantMap
    const getOrAddParticipant = (handle: string, yptUd?: number, appUserId?: string) => {
      const cleanKey = (handle || '').replace(/^@/, '').trim().toLowerCase();
      for (const existing of participantMap.values()) {
        if (areYptHandlesMatching(existing.yptHandle, handle, yptUd ? String(yptUd) : undefined)) {
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

    // 1. Accumulate points from past locked snapshots
    dailySnapshots.forEach((snap) => {
      if (snap.participantStandings && Array.isArray(snap.participantStandings)) {
        snap.participantStandings.forEach((ps) => {
          const entry = getOrAddParticipant(ps.yptHandle, ps.yptUd, ps.appUserId);
          entry.totalPoints += ps.dayPoints || 0;
          entry.totalHours += ps.dayHours || 0;
          grandTotalHours += ps.dayHours || 0;
        });
      } else if (snap.memberSnapshots) {
        Object.values(snap.memberSnapshots).forEach((ms) => {
          const entry = getOrAddParticipant(ms.handle, ms.rawYptUd, ms.appUserId);
          entry.totalPoints += ms.netPoints || 0;
          entry.totalHours += ms.hoursStudied || 0;
          grandTotalHours += ms.hoursStudied || 0;
        });
      } else if (Array.isArray(snap.memberRecords)) {
        snap.memberRecords.forEach((mr) => {
          const entry = getOrAddParticipant(mr.yptHandle, mr.userId ? Number(mr.userId) : undefined);
          entry.totalPoints += mr.netPoints || 0;
          entry.totalHours += mr.hoursStudied || 0;
          grandTotalHours += mr.hoursStudied || 0;
        });
      }
    });

    // 2. Accumulate points from unclosed stats (e.g. today)
    unclosedStats.forEach((stat) => {
      const entry = getOrAddParticipant(stat.memberHandle, stat.matchedUid ? Number(stat.matchedUid) : undefined);
      entry.totalPoints += stat.pointsEarned || 0;
      entry.totalHours += stat.hoursStudied || 0;
      grandTotalHours += stat.hoursStudied || 0;
    });

    // Sort participants by totalPoints desc, then totalHours desc
    const sortedParticipants = Array.from(participantMap.values()).map((p) => ({
      ...p,
      totalHours: Math.round(p.totalHours * 100) / 100,
    }));
    sortedParticipants.sort((a, b) => b.totalPoints - a.totalPoints || b.totalHours - a.totalHours);

    const topParticipants = sortedParticipants.map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));

    const topChampion = topParticipants[0];

    // MVP: member with highest cumulative study hours
    const mvpSorted = [...topParticipants].sort((a, b) => b.totalHours - a.totalHours);
    const topMvp = mvpSorted[0];

    return {
      mode: 'individual',
      winningParticipantUd: topChampion?.yptUd,
      winningParticipantHandle: topChampion?.yptHandle,
      winningParticipantPoints: topChampion?.totalPoints,
      winningParticipantHours: topChampion?.totalHours,
      finalMvpHandle: topMvp?.yptHandle || topChampion?.yptHandle,
      finalMvpHours: topMvp?.totalHours,
      topParticipants,
      grandTotalHours: Math.round(grandTotalHours * 100) / 100,
      totalSubmissions: submissions.length,
    };
  } else {
    // TEAM MODE: Aggregate team totals and find winning team + overall MVP
    const teamMap = new Map<string, {
      id: string;
      name: string;
      color?: string;
      totalPoints: number;
      totalHours: number;
      memberUids: string[];
    }>();

    (challenge.teams || []).forEach((t) => {
      teamMap.set(t.id, {
        id: t.id,
        name: t.name || `Team ${t.id}`,
        color: t.color,
        totalPoints: t.totalPoints || 0,
        totalHours: 0,
        memberUids: t.memberUids || [],
      });
    });

    // Map to track individual hours for overall MVP
    const memberHoursMap = new Map<string, number>();

    // 1. Add points and hours from all past finalized daily snapshots
    dailySnapshots.forEach((snapshot) => {
      if (snapshot.teamStandings && Array.isArray(snapshot.teamStandings)) {
        snapshot.teamStandings.forEach((ts) => {
          const t = teamMap.get(ts.teamId);
          if (t) {
            t.totalHours += ts.dayHours || 0;
            grandTotalHours += ts.dayHours || 0;
          }
        });
      }

      if (snapshot.memberSnapshots) {
        Object.values(snapshot.memberSnapshots).forEach((ms) => {
          const clean = (ms.handle || '').replace(/^@/, '').trim().toLowerCase();
          const prev = memberHoursMap.get(clean) || 0;
          memberHoursMap.set(clean, prev + (ms.hoursStudied || 0));
        });
      } else if (Array.isArray(snapshot.memberRecords)) {
        snapshot.memberRecords.forEach((mr) => {
          const clean = (mr.yptHandle || '').replace(/^@/, '').trim().toLowerCase();
          const prev = memberHoursMap.get(clean) || 0;
          memberHoursMap.set(clean, prev + (mr.hoursStudied || 0));
        });
      }
    });

    // 2. Add unclosed stats
    unclosedStats.forEach((stat) => {
      const clean = (stat.memberHandle || '').replace(/^@/, '').trim().toLowerCase();
      const prev = memberHoursMap.get(clean) || 0;
      memberHoursMap.set(clean, prev + (stat.hoursStudied || 0));
      grandTotalHours += stat.hoursStudied || 0;

      for (const t of teamMap.values()) {
        if (t.memberUids.some((m) => areYptHandlesMatching(m, stat.memberHandle, stat.matchedUid))) {
          t.totalPoints += stat.pointsEarned || 0;
          t.totalHours += stat.hoursStudied || 0;
          break;
        }
      }
    });

    // Sort teams by totalPoints desc, then totalHours desc
    const sortedTeams = Array.from(teamMap.values()).map((t) => ({
      ...t,
      totalHours: Math.round(t.totalHours * 100) / 100,
    }));
    sortedTeams.sort((a, b) => b.totalPoints - a.totalPoints || b.totalHours - a.totalHours);

    const rankedTeams = sortedTeams.map((t, idx) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      totalPoints: t.totalPoints,
      totalHours: t.totalHours,
      rank: idx + 1,
    }));

    const winningTeam = rankedTeams[0];

    // MVP: member with max study hours across all teams
    const sortedMembers = Array.from(memberHoursMap.entries()).map(([handle, hours]) => ({ handle, hours }));
    sortedMembers.sort((a, b) => b.hours - a.hours);
    const topMvp = sortedMembers.length > 0 && sortedMembers[0].hours > 0 ? sortedMembers[0] : null;

    return {
      mode: 'team',
      winningTeamId: winningTeam?.id,
      winningTeamName: winningTeam?.name,
      winningTeamPoints: winningTeam?.totalPoints,
      finalMvpHandle: topMvp?.handle || '',
      finalMvpHours: topMvp?.hours ? Math.round(topMvp.hours * 100) / 100 : 0,
      rankedTeams,
      grandTotalHours: Math.round(grandTotalHours * 100) / 100,
      totalSubmissions: submissions.length,
    };
  }
}

/**
 * Marks a YPT Challenge as completed and saves completion metadata.
 * Uses resolveChallengeWinners to automatically calculate winners if not explicitly provided.
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
  const isSolo = calculated.mode === 'individual';

  const updates: Partial<YptChallenge> = {
    status: 'completed',
    completedAt: new Date().toISOString(),
    completedBy: summaryData?.completedBy || 'admin',
    winningTeamId: isSolo ? '' : (summaryData?.winningTeamId || calculated.winningTeamId || ''),
    winningParticipantUd: isSolo
      ? (summaryData?.winningParticipantUd !== undefined ? summaryData.winningParticipantUd : calculated.winningParticipantUd)
      : undefined,
    winningParticipantHandle: isSolo
      ? (summaryData?.winningParticipantHandle || calculated.winningParticipantHandle || '')
      : '',
    finalMvpHandle: summaryData?.finalMvpHandle || calculated.finalMvpHandle || '',
  };

  await updateYptChallenge(challengeId, updates);
  return calculated;
}

/**
 * Re-opens a completed YPT Challenge back to active status.
 */
export async function reopenYptChallenge(challengeId: string): Promise<void> {
  await updateYptChallenge(challengeId, {
    status: 'active',
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
  // Optimistically remove challenge from Zustand store
  useYptStore.getState().optimisticRemoveChallenge(challengeId);

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

  // Optimistically update Zustand store (0ms UI latency)
  useYptStore.getState().optimisticAddSubmissionLog(newSubmission);

  await setDoc(subDocRef, sanitizeForFirestore(newSubmission));

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
 * Real-time listener for submission logs of a specific YPT Challenge with change delta tracking.
 */
export function subscribeToYptSubmissions(
  challengeId: string,
  callback: (
    logs: YptSubmissionLog[],
    docChanges?: { type: 'added' | 'modified' | 'removed'; item: YptSubmissionLog }[],
    metadata?: { hasPendingWrites: boolean; fromCache: boolean }
  ) => void
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

      const changes = snap.docChanges().map((change) => {
        const data = change.doc.data() as YptSubmissionLog;
        const targetDateYmd = data.targetDateYmd || data.dateYmd || getLocalYmd(data.timestamp);
        return {
          type: change.type as 'added' | 'modified' | 'removed',
          item: {
            ...data,
            id: change.doc.id,
            challengeId: data.challengeId || challengeId,
            dateYmd: targetDateYmd,
            targetDateYmd,
          },
        };
      });

      callback(logs, changes, {
        hasPendingWrites: snap.metadata.hasPendingWrites,
        fromCache: snap.metadata.fromCache,
      });
    },
    (err) => {
      console.warn("Error listening to submission logs:", err);
    }
  );
}

/**
 * Alias for subscribeToYptSubmissions.
 */
export const subscribeToSubmissionLogs = subscribeToYptSubmissions;

/**
 * Updates submission status (verified / rejected).
 */
export async function updateYptSubmissionStatus(
  challengeId: string,
  submissionId: string,
  status: "verified" | "rejected"
): Promise<void> {
  // Optimistically update store immediately (0ms UI latency)
  useYptStore.getState().optimisticUpdateSubmissionStatus(submissionId, status);

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

  const todayStr = getYptDayYmd();

  const [submissions, dailySnapshots] = await Promise.all([
    getYptSubmissionLogs(challengeId),
    getAllDailySnapshots(challengeId),
  ]);

  const deduplicatedStats = getDeduplicatedDailyMemberStats(submissions, challenge);

  // Set of past dates covered by finalized daily snapshots
  const closedSnapshotDates = new Set(
    dailySnapshots
      .filter((s) => s.targetDateYmd < todayStr)
      .map((s) => s.targetDateYmd)
  );

  // Filter deduplicated submission stats for dates NOT covered by past closed snapshots (e.g. today or unclosed)
  const unclosedStats = deduplicatedStats.filter(
    (stat) => !closedSnapshotDates.has(stat.dateYmd)
  );

  // Calculate team point totals by combining past closed snapshots + today's unclosed stats
  const updatedTeams: YptTeam[] = challenge.teams.map((team) => {
    let teamTotal = 0;

    // 1. Add points from all past finalized daily snapshots
    dailySnapshots
      .filter((s) => s.targetDateYmd < todayStr)
      .forEach((snapshot) => {
        if (snapshot.teamPointsMap && typeof snapshot.teamPointsMap[team.id] === 'number') {
          teamTotal += snapshot.teamPointsMap[team.id];
        } else if (Array.isArray(snapshot.memberRecords)) {
          snapshot.memberRecords.forEach((rec) => {
            if (rec.teamId === team.id || (team.memberUids || []).some((m) => areYptHandlesMatching(m, rec.yptHandle, rec.userId))) {
              teamTotal += rec.netPoints || 0;
            }
          });
        }
      });

    // 2. Add points from today's unclosed / live submissions
    (team.memberUids || []).forEach((handleOrUid) => {
      let memberPts = 0;
      unclosedStats.forEach((stat) => {
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
    batch.set(logRef, sanitizeForFirestore({
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
    }));
  });

  // Executes all writes in a single batch request
  await batch.commit();
}

/**
 * Resets all global leaderboard data by permanently deleting submission logs across all YPT challenges
 * and setting team total points back to 0. Available strictly to the application owner.
 */
export async function resetGlobalLeaderboardData(): Promise<void> {
  const challengesCol = collection(db, CHALLENGES_COLLECTION);
  const challengesSnap = await getDocs(challengesCol);

  for (const challengeDoc of challengesSnap.docs) {
    const challengeId = challengeDoc.id;
    const challengeData = challengeDoc.data() as YptChallenge;

    // Delete all submissions in subcollection
    const subColRef = collection(db, CHALLENGES_COLLECTION, challengeId, "submissions");
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

    // Reset team scores to 0 for this challenge
    if (Array.isArray(challengeData.teams) && challengeData.teams.length > 0) {
      const resetTeams = challengeData.teams.map((team) => ({
        ...team,
        totalPoints: 0,
      }));
      await updateDoc(doc(db, CHALLENGES_COLLECTION, challengeId), {
        teams: resetTeams,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Force refresh Zustand store
  useYptStore.getState().forceRefresh();
}

/**
 * Saves or updates a daily finalized snapshot for a challenge in Firestore.
 * Stored at: yptChallenges/{challengeId}/dailySnapshots/{targetDateYmd}
 * and mirrored to daily_snapshots/{targetDateYmd} for backwards compatibility.
 */
export async function saveDailySnapshot(
  challengeId: string,
  snapshot: YptDailyDaySnapshot
): Promise<void> {
  const dateYmd = snapshot.dateYmd || snapshot.targetDateYmd || getYptDayYmd();
  const docId = dateYmd; // Canonical document ID: "YYYY-MM-DD"
  
  const dataToSave: YptDailyDaySnapshot = {
    ...snapshot,
    id: docId,
    challengeId,
    dateYmd,
    targetDateYmd: dateYmd,
  };

  const cleanData = sanitizeForFirestore(dataToSave);

  // 1. Write to canonical date-keyed subcollection: yptChallenges/{challengeId}/dailySnapshots/{YYYY-MM-DD}
  const snapDocRef = doc(db, CHALLENGES_COLLECTION, challengeId, "dailySnapshots", docId);
  await setDoc(snapDocRef, cleanData, { merge: true });

  // 2. Also mirror to legacy daily_snapshots for complete backwards compatibility
  try {
    const legacyDocRef = doc(db, CHALLENGES_COLLECTION, challengeId, "daily_snapshots", `daily_${docId}`);
    await setDoc(legacyDocRef, cleanData, { merge: true });
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
  // 1. Check canonical subcollection yptChallenges/{challengeId}/dailySnapshots/{YYYY-MM-DD}
  const canonicalDocRef = doc(db, CHALLENGES_COLLECTION, challengeId, "dailySnapshots", targetDateYmd);
  const canonicalSnap = await getDoc(canonicalDocRef);
  if (canonicalSnap.exists()) {
    const d = canonicalSnap.data() as any;
    return {
      ...d,
      id: canonicalSnap.id,
      dateYmd: d.dateYmd || targetDateYmd,
      targetDateYmd: d.targetDateYmd || d.dateYmd || targetDateYmd,
    } as YptDailyDaySnapshot;
  }

  // 2. Fallback to legacy daily_snapshots/daily_YYYY-MM-DD
  const legacyDocId = `daily_${targetDateYmd}`;
  const legacyDocRef = doc(db, CHALLENGES_COLLECTION, challengeId, "daily_snapshots", legacyDocId);
  const legacySnap = await getDoc(legacyDocRef);
  if (legacySnap.exists()) {
    const d = legacySnap.data() as any;
    return {
      ...d,
      id: legacySnap.id,
      dateYmd: d.dateYmd || targetDateYmd,
      targetDateYmd: d.targetDateYmd || d.dateYmd || targetDateYmd,
    } as YptDailyDaySnapshot;
  }

  // 3. Fallback to legacy daily_snapshots/YYYY-MM-DD
  const altSnapDocRef = doc(db, CHALLENGES_COLLECTION, challengeId, "daily_snapshots", targetDateYmd);
  const altSnap = await getDoc(altSnapDocRef);
  if (altSnap.exists()) {
    const d = altSnap.data() as any;
    return {
      ...d,
      id: altSnap.id,
      dateYmd: d.dateYmd || targetDateYmd,
      targetDateYmd: d.targetDateYmd || d.dateYmd || targetDateYmd,
    } as YptDailyDaySnapshot;
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

  // 1. Fetch from canonical dailySnapshots
  try {
    const colRef = collection(db, CHALLENGES_COLLECTION, challengeId, "dailySnapshots");
    const snap = await getDocs(colRef);
    snap.forEach((d) => {
      const data = d.data() as any;
      const dateYmd = data.dateYmd || data.targetDateYmd || d.id.replace(/^daily_/, '');
      snapshotsMap.set(dateYmd, {
        ...data,
        id: d.id,
        dateYmd,
        targetDateYmd: dateYmd,
      } as YptDailyDaySnapshot);
    });
  } catch (err) {
    console.warn("Could not query dailySnapshots, falling back:", err);
  }

  // 2. Fetch from legacy daily_snapshots (fill any missing dates)
  try {
    const legacyColRef = collection(db, CHALLENGES_COLLECTION, challengeId, "daily_snapshots");
    const legacySnap = await getDocs(legacyColRef);
    legacySnap.forEach((d) => {
      const data = d.data() as any;
      const dateYmd = data.dateYmd || data.targetDateYmd || d.id.replace(/^daily_/, '');
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
    console.warn("Could not query daily_snapshots:", err);
  }

  const snapshots = Array.from(snapshotsMap.values());
  // Sort chronologically by dateYmd
  return snapshots.sort((a, b) => (a.dateYmd || a.targetDateYmd || '').localeCompare(b.dateYmd || b.targetDateYmd || ''));
}

/**
 * Deletes a daily snapshot for a challenge.
 */
export async function deleteDailySnapshot(
  challengeId: string,
  targetDateYmd: string
): Promise<void> {
  const docId = targetDateYmd;
  const snapDocRef = doc(db, CHALLENGES_COLLECTION, challengeId, "dailySnapshots", docId);
  await deleteDoc(snapDocRef);

  try {
    const legacyDocRef = doc(db, CHALLENGES_COLLECTION, challengeId, "daily_snapshots", `daily_${targetDateYmd}`);
    await deleteDoc(legacyDocRef);
  } catch {
    // Ignore legacy delete errors
  }
}

/**
 * Auto-closes any missing past daily snapshots for a challenge.
 * Evaluates from challenge startDate up to yesterday (or endDate), using IST day boundary (05:00 AM IST).
 * If missing, it aggregates existing unclosed/manual submission logs or calculates point rules,
 * writes the finalized snapshot, and updates team points.
 */
export async function autoCloseMissingDays(
  challenge: YptChallenge
): Promise<{ closedCount: number; newSnapshots: YptDailyDaySnapshot[] }> {
  if (!challenge || !challenge.id) {
    return { closedCount: 0, newSnapshots: [] };
  }

  const startDateYmd = getChallengeStartDateYmd(challenge);
  const endDateYmd = getChallengeEndDateYmd(challenge);

  // Yesterday in YPT IST day boundary
  const currentYptDay = getYptDayYmd();
  const yesterdayYmd = getYesterdayYptDayYmd();

  // Upper boundary of past days that can be closed (cannot close today or future dates)
  const maxCloseDateYmd = endDateYmd < yesterdayYmd ? endDateYmd : yesterdayYmd;

  if (!startDateYmd || !maxCloseDateYmd || startDateYmd > maxCloseDateYmd) {
    return { closedCount: 0, newSnapshots: [] };
  }

  // Generate all calendar dates in range [startDateYmd, maxCloseDateYmd]
  const dateList: string[] = [];
  const [startY, startM, startD] = startDateYmd.split('-').map(Number);
  const [endY, endM, endD] = maxCloseDateYmd.split('-').map(Number);

  if (!startY || !startM || !startD || !endY || !endM || !endD) {
    return { closedCount: 0, newSnapshots: [] };
  }

  const curDate = new Date(startY, startM - 1, startD);
  const finishDate = new Date(endY, endM - 1, endD);

  while (curDate <= finishDate) {
    dateList.push(getLocalYmd(curDate));
    curDate.setDate(curDate.getDate() + 1);
  }

  if (dateList.length === 0) {
    return { closedCount: 0, newSnapshots: [] };
  }

  // Query existing snapshots for this challenge
  const existingSnapshots = await getAllDailySnapshots(challenge.id);
  const existingDates = new Set(existingSnapshots.map((s) => s.targetDateYmd || s.dateYmd));

  const missingDates = dateList.filter((d) => !existingDates.has(d));
  if (missingDates.length === 0) {
    return { closedCount: 0, newSnapshots: [] };
  }

  // Fetch all existing submission logs for the challenge to calculate daily points
  const allSubmissions = await getYptSubmissionLogs(challenge.id);
  const allDeduplicatedStats = getDeduplicatedDailyMemberStats(allSubmissions, challenge);

  const newSnapshots: YptDailyDaySnapshot[] = [];

  for (const dateYmd of missingDates) {
    const statsForDate = allDeduplicatedStats.filter((s) => s.dateYmd === dateYmd);
    const isSoloMode = (challenge.mode || 'team') === 'individual';
    const teamPointsMap: Record<string, number> = {};
    const memberRecords: NonNullable<YptDailyDaySnapshot['memberRecords']> = [];
    const memberSnapshots: YptDailyDaySnapshot['memberSnapshots'] = {};
    const highWaterMarks: Record<string, number> = {};
    const maxContinuousHighWaterMarks: Record<string, number> = {};
    const teamStandingsDraft: Array<{ teamId: string; teamName: string; dayHours: number; dayPoints: number }> = [];
    let participantStandings: Array<{ yptUd?: number; yptHandle: string; appUserId?: string; dayHours: number; dayPoints: number; rank: number }> = [];
    let dayTotalPoints = 0;
    let dayTotalHours = 0;
    let activeMemberCount = 0;

    if (isSoloMode) {
      const participantsList: Array<{ yptUd?: number; yptHandle: string; appUserId?: string }> =
        challenge.participants && challenge.participants.length > 0
          ? challenge.participants
          : [];

      participantsList.forEach((p) => {
        const cleanHandle = (p.yptHandle || '').replace(/^@/, '').trim().toLowerCase();
        const memberHandleOrUid = p.yptHandle || cleanHandle;
        const foundStat = statsForDate.find((s) =>
          areYptHandlesMatching(s.memberHandle, memberHandleOrUid, s.matchedUid || (p.yptUd ? String(p.yptUd) : undefined))
        );

        if (foundStat) {
          const hours = foundStat.hoursStudied || 0;
          const net = foundStat.pointsEarned || 0;
          const maxContMs = foundStat.maxContinuousMs || 0;
          highWaterMarks[cleanHandle] = hours;
          maxContinuousHighWaterMarks[cleanHandle] = maxContMs;
          if (hours > 0) activeMemberCount++;
          dayTotalHours += hours;

          const appliedRules = foundStat.detectedRules
            ? foundStat.detectedRules.map((r) => ({
                ruleId: r.ruleId,
                ruleName: r.ruleName,
                emoji: r.emoji || '⭐',
                points: r.points || 0,
              }))
            : [];

          const intervalVal = challenge.rules?.studyIntervalValue ?? 1;
          const intervalUnit = challenge.rules?.studyIntervalUnit ?? 'hours';
          const intervalHours = intervalUnit === 'minutes' ? intervalVal / 60 : intervalVal || 1;
          const ptsPerInterval = challenge.rules?.pointsPerInterval ?? challenge.rules?.pointsPerStudyHour ?? 1;
          const basePoints = Math.floor(hours / (intervalHours || 1)) * ptsPerInterval;

          const bonusPoints = appliedRules
            .filter((r) => r.points > 0)
            .reduce((acc, r) => acc + r.points, 0);
          const penaltyPoints = appliedRules
            .filter((r) => r.points < 0)
            .reduce((acc, r) => acc + Math.abs(r.points), 0);

          const appliedRuleBreakdown = appliedRules.map((r) => ({
            ruleId: r.ruleId || '',
            ruleName: r.ruleName,
            emoji: r.emoji,
            points: r.points,
            type: (r.points < 0 ? 'penalty' : r.points > 0 ? 'bonus' : 'base') as 'bonus' | 'penalty' | 'base' | 'milestone',
          }));

          const memberDoc = {
            handle: foundStat.memberHandle || memberHandleOrUid,
            rawYptUd: p.yptUd,
            appUserId: p.appUserId,
            hoursStudied: hours,
            studyMs: Math.round(hours * 3600000),
            maxContinuousMs: maxContMs,
            isCurrentlyStudying: false,
            completedNativeChallengeIds: [],
            basePoints,
            bonusPoints,
            penaltyPoints,
            netPoints: net,
            appliedRuleBreakdown,
            status: 'active' as const,
            lastSyncedAt: new Date().toISOString(),
          };

          memberSnapshots[cleanHandle] = memberDoc;

          memberRecords.push({
            yptHandle: foundStat.memberHandle || memberHandleOrUid,
            userId: foundStat.matchedUid || (p.yptUd ? String(p.yptUd) : undefined),
            hoursStudied: hours,
            basePoints,
            bonusPoints,
            penaltyPoints,
            netPoints: net,
            appliedRules,
          });

          dayTotalPoints += net;
        } else {
          // Member had 0 study time recorded on this past date
          highWaterMarks[cleanHandle] = 0;
          maxContinuousHighWaterMarks[cleanHandle] = 0;
          const penaltyThreshold =
            challenge.rules?.penaltyThresholdValue ??
            challenge.rules?.noStudyPenaltyThresholdHours ??
            0;
          const penaltyVal = challenge.rules?.penaltyPoints || 0;
          const isPenalized = penaltyThreshold > 0 && penaltyVal > 0;
          const penaltyPoints = isPenalized ? penaltyVal : 0;
          const netPoints = -penaltyPoints;

          const appliedRules = isPenalized
            ? [
                {
                  ruleName: 'No Study Penalty',
                  emoji: '⚠️',
                  points: -penaltyVal,
                },
              ]
            : [];

          memberSnapshots[cleanHandle] = {
            handle: cleanHandle,
            rawYptUd: p.yptUd,
            appUserId: p.appUserId,
            hoursStudied: 0,
            studyMs: 0,
            maxContinuousMs: 0,
            isCurrentlyStudying: false,
            completedNativeChallengeIds: [],
            basePoints: 0,
            bonusPoints: 0,
            penaltyPoints,
            netPoints,
            appliedRuleBreakdown: isPenalized
              ? [
                  {
                    ruleId: 'no_study_penalty',
                    ruleName: 'No Study Penalty',
                    emoji: '⚠️',
                    points: -penaltyVal,
                    type: 'penalty',
                  },
                ]
              : [],
            status: 'active',
            lastSyncedAt: new Date().toISOString(),
          };

          memberRecords.push({
            yptHandle: cleanHandle,
            hoursStudied: 0,
            basePoints: 0,
            bonusPoints: 0,
            penaltyPoints,
            netPoints,
            appliedRules,
          });

          dayTotalPoints += netPoints;
        }
      });

      const participantDraft = Object.values(memberSnapshots).map((m: any) => ({
        yptUd: m.rawYptUd,
        yptHandle: m.handle,
        appUserId: m.appUserId,
        dayHours: m.hoursStudied || 0,
        dayPoints: m.netPoints || 0,
      }));
      participantDraft.sort((a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours);
      participantStandings = participantDraft.map((p, idx) => ({ ...p, rank: idx + 1 }));
    } else {
      (challenge.teams || []).forEach((team) => {
        let teamDailyPoints = 0;
        let teamDailyHours = 0;

        (team.memberUids || []).forEach((memberHandleOrUid) => {
          const cleanHandle = memberHandleOrUid.replace(/^@/, '').trim().toLowerCase();
          const foundStat = statsForDate.find((s) =>
            areYptHandlesMatching(s.memberHandle, memberHandleOrUid, s.matchedUid)
          );

          if (foundStat) {
            const hours = foundStat.hoursStudied || 0;
            const net = foundStat.pointsEarned || 0;
            const maxContMs = foundStat.maxContinuousMs || 0;
            highWaterMarks[cleanHandle] = hours;
            maxContinuousHighWaterMarks[cleanHandle] = maxContMs;
            if (hours > 0) activeMemberCount++;
            dayTotalHours += hours;
            teamDailyHours += hours;

            const appliedRules = foundStat.detectedRules
              ? foundStat.detectedRules.map((r) => ({
                  ruleId: r.ruleId,
                  ruleName: r.ruleName,
                  emoji: r.emoji || '⭐',
                  points: r.points || 0,
                }))
              : [];

            const intervalVal = challenge.rules?.studyIntervalValue ?? 1;
            const intervalUnit = challenge.rules?.studyIntervalUnit ?? 'hours';
            const intervalHours = intervalUnit === 'minutes' ? intervalVal / 60 : intervalVal || 1;
            const ptsPerInterval = challenge.rules?.pointsPerInterval ?? challenge.rules?.pointsPerStudyHour ?? 1;
            const basePoints = Math.floor(hours / (intervalHours || 1)) * ptsPerInterval;

            const bonusPoints = appliedRules
              .filter((r) => r.points > 0)
              .reduce((acc, r) => acc + r.points, 0);
            const penaltyPoints = appliedRules
              .filter((r) => r.points < 0)
              .reduce((acc, r) => acc + Math.abs(r.points), 0);

            const appliedRuleBreakdown = appliedRules.map((r) => ({
              ruleId: r.ruleId || '',
              ruleName: r.ruleName,
              emoji: r.emoji,
              points: r.points,
              type: (r.points < 0 ? 'penalty' : r.points > 0 ? 'bonus' : 'base') as 'bonus' | 'penalty' | 'base' | 'milestone',
            }));

            const memberDoc = {
              handle: foundStat.memberHandle || memberHandleOrUid,
              rawYptUd: undefined,
              hoursStudied: hours,
              studyMs: Math.round(hours * 3600000),
              maxContinuousMs: maxContMs,
              isCurrentlyStudying: false,
              completedNativeChallengeIds: [],
              basePoints,
              bonusPoints,
              penaltyPoints,
              netPoints: net,
              appliedRuleBreakdown,
              status: 'active' as const,
              lastSyncedAt: new Date().toISOString(),
            };

            memberSnapshots[cleanHandle] = memberDoc;

            memberRecords.push({
              yptHandle: foundStat.memberHandle || memberHandleOrUid,
              userId: foundStat.matchedUid,
              teamId: team.id,
              hoursStudied: hours,
              basePoints,
              bonusPoints,
              penaltyPoints,
              netPoints: net,
              appliedRules,
            });

            teamDailyPoints += net;
          } else {
            // Member had 0 study time recorded on this past date
            highWaterMarks[cleanHandle] = 0;
            maxContinuousHighWaterMarks[cleanHandle] = 0;
            const penaltyThreshold =
              challenge.rules?.penaltyThresholdValue ??
              challenge.rules?.noStudyPenaltyThresholdHours ??
              0;
            const penaltyVal = challenge.rules?.penaltyPoints || 0;
            const isPenalized = penaltyThreshold > 0 && penaltyVal > 0;
            const penaltyPoints = isPenalized ? penaltyVal : 0;
            const netPoints = -penaltyPoints;

            const appliedRules = isPenalized
              ? [
                  {
                    ruleName: 'No Study Penalty',
                    emoji: '⚠️',
                    points: -penaltyVal,
                  },
                ]
              : [];

            memberSnapshots[cleanHandle] = {
              handle: cleanHandle,
              rawYptUd: undefined,
              hoursStudied: 0,
              studyMs: 0,
              maxContinuousMs: 0,
              isCurrentlyStudying: false,
              completedNativeChallengeIds: [],
              basePoints: 0,
              bonusPoints: 0,
              penaltyPoints,
              netPoints,
              appliedRuleBreakdown: isPenalized
                ? [
                    {
                      ruleId: 'no_study_penalty',
                      ruleName: 'No Study Penalty',
                      emoji: '⚠️',
                      points: -penaltyVal,
                      type: 'penalty',
                    },
                  ]
                : [],
              status: 'active',
              lastSyncedAt: new Date().toISOString(),
            };

            memberRecords.push({
              yptHandle: cleanHandle,
              teamId: team.id,
              hoursStudied: 0,
              basePoints: 0,
              bonusPoints: 0,
              penaltyPoints,
              netPoints,
              appliedRules,
            });

            teamDailyPoints += netPoints;
          }
        });

        teamPointsMap[team.id] = teamDailyPoints;
        dayTotalPoints += teamDailyPoints;

        teamStandingsDraft.push({
          teamId: team.id,
          teamName: team.name || `Team ${team.id}`,
          dayHours: teamDailyHours,
          dayPoints: teamDailyPoints,
        });
      });
    }

    // Rank teams descending by dayPoints, then dayHours
    teamStandingsDraft.sort((a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours);
    const teamStandings = teamStandingsDraft.map((t, idx) => ({
      ...t,
      rank: idx + 1,
    }));

    const snapshot: YptDailyDaySnapshot = {
      id: dateYmd,
      challengeId: challenge.id,
      dateYmd: dateYmd,
      targetDateYmd: dateYmd,
      isLocked: true,
      lockedAt: new Date().toISOString(),
      lockedBy: 'cron_system',
      totalChallengeHours: dayTotalHours,
      totalChallengePoints: dayTotalPoints,
      activeMemberCount,
      memberSnapshots,
      teamStandings: isSoloMode ? [] : teamStandings,
      participantStandings: isSoloMode ? participantStandings : undefined,
      isAutoClosed: true,
      closedAt: Date.now(),
      totalPointsAwarded: dayTotalPoints,
      teamPointsMap,
      highWaterMarks,
      maxContinuousHighWaterMarks,
      memberRecords,
    };

    await saveDailySnapshot(challenge.id, snapshot);
    newSnapshots.push(snapshot);
  }

  // Recalculate team points to aggregate newly closed historical days
  if (newSnapshots.length > 0) {
    await recalculateTeamPointsFromSubmissions(challenge.id);
  }

  return {
    closedCount: newSnapshots.length,
    newSnapshots,
  };
}

/**
 * Principle B: The "High-Water Mark" Continuous Live Sync
 * Updates or creates the active snapshot for a challenge using non-destructive Math.max logic.
 * When YPT wipes dl.sm to 0 at 5:00 AM IST, the peak accumulated hours from earlier in the night are retained.
 * Furthermore, during the live open day, premature penalties are NOT applied so members are not penalized while studying.
 */
export async function syncChallengeDaySnapshotWithHighWaterMark(
  challenge: YptChallenge,
  liveRoster: YptApiMember[],
  targetDateYmd?: string,
  forceFinalLock: boolean = false
): Promise<YptDailyDaySnapshot> {
  if (!challenge || !challenge.id) {
    throw new Error('Invalid challenge object');
  }

  const activeYmd = targetDateYmd || getYptDayYmd();
  const endDateYmd = getChallengeEndDateYmd(challenge);

  // Strict End Date Guard: Refuse to generate/sync an active open snapshot for dates beyond challenge.endDate
  if (activeYmd > endDateYmd && !forceFinalLock) {
    const existingSnap = await getDailySnapshot(challenge.id, activeYmd);
    if (existingSnap) return existingSnap;
    // Fall back to end date snapshot or return a dummy non-persisted snapshot
    const lastValidSnap = await getDailySnapshot(challenge.id, endDateYmd);
    if (lastValidSnap) return lastValidSnap;
  }

  // Load any existing snapshot for this date
  const existingSnapshot = await getDailySnapshot(challenge.id, activeYmd);

  // If already locked and not a force final lock, return existing without modification
  if (existingSnapshot?.isLocked && !forceFinalLock) {
    return existingSnapshot;
  }

  const existingHwms: Record<string, number> = existingSnapshot?.highWaterMarks || {};
  const updatedHwms: Record<string, number> = { ...existingHwms };
  const existingMaxContHwms: Record<string, number> = existingSnapshot?.maxContinuousHighWaterMarks || {};
  const updatedMaxContHwms: Record<string, number> = { ...existingMaxContHwms };

  // Fetch all existing manual / OCR submission logs for this challenge & date
  const allSubmissions = await getYptSubmissionLogs(challenge.id);
  const allDeduplicatedStats = getDeduplicatedDailyMemberStats(allSubmissions, challenge);
  const statsForDate = allDeduplicatedStats.filter((s) => s.dateYmd === activeYmd);

  const isSoloMode = (challenge.mode || 'team') === 'individual';
  const teamPointsMap: Record<string, number> = {};
  const memberRecords: NonNullable<YptDailyDaySnapshot['memberRecords']> = [];
  const memberSnapshots: YptDailyDaySnapshot['memberSnapshots'] = {};
  const teamStandingsDraft: Array<{ teamId: string; teamName: string; dayHours: number; dayPoints: number }> = [];
  let participantStandings: Array<{ yptUd?: number; yptHandle: string; appUserId?: string; dayHours: number; dayPoints: number; rank: number }> = [];
  let dayTotalPoints = 0;
  let dayTotalHours = 0;
  let activeMemberCount = 0;

  // Decide if penalty should be applied:
  // We only apply the penalty if the target date is strictly older than the current YPT Day or forceFinalLock is true
  const isPastLockedDate = activeYmd < getYptDayYmd();
  const applyPenalty = isPastLockedDate || forceFinalLock;

  if (isSoloMode) {
    const participantsList: Array<{ yptUd?: number; yptHandle: string; appUserId?: string }> =
      challenge.participants && challenge.participants.length > 0
        ? challenge.participants
        : (liveRoster || []).map((m) => ({ yptUd: m.ud, yptHandle: m.n }));

    participantsList.forEach((p) => {
      const cleanHandle = (p.yptHandle || '').replace(/^@/, '').trim().toLowerCase();
      const memberHandleOrUid = p.yptHandle || cleanHandle;

      // Find manual submission stat (if any)
      const foundStat = statsForDate.find((s) =>
        areYptHandlesMatching(s.memberHandle, memberHandleOrUid, s.matchedUid || (p.yptUd ? String(p.yptUd) : undefined))
      );

      // Find member in live API roster
      const liveMember = (liveRoster || []).find((m) => {
        if (!m) return false;
        const mHandle = (m.n || '').replace(/^@/, '').trim();
        const mUid = m.ud ? String(m.ud) : undefined;
        return areYptHandlesMatching(mHandle, memberHandleOrUid, mUid || (p.yptUd ? String(p.yptUd) : undefined));
      });

      // 1. Calculate incoming hours from API
      const apiLiveHours = liveMember ? getMemberStudyHoursFromApi(liveMember) : 0;
      const manualHours = foundStat ? foundStat.hoursStudied || 0 : 0;

      // 2. High-Water Mark for total hours: Math.max(previous recorded HWM, apiLiveHours, manualHours)
      const prevHwm = existingHwms[cleanHandle] ?? 0;
      const peakHours = applyHighWaterMark(prevHwm, Math.max(apiLiveHours, manualHours));
      updatedHwms[cleanHandle] = peakHours;

      // 2b. High-Water Mark for max continuous session (ms): Math.max(prev HWM, api live mm, manual mm)
      const apiLiveMaxContMs = (liveMember?.dl && typeof liveMember.dl.mm === 'number') ? liveMember.dl.mm : 0;
      const manualMaxContMs = foundStat?.maxContinuousMs || 0;
      const prevMaxContHwm = existingMaxContHwms[cleanHandle] ?? 0;
      const peakMaxContMs = Math.max(prevMaxContHwm, apiLiveMaxContMs, manualMaxContMs);
      updatedMaxContHwms[cleanHandle] = peakMaxContMs;

      if (peakHours > 0) activeMemberCount++;
      dayTotalHours += peakHours;

      // 3. Extract completed native challenges
      const completedChallengeIds: number[] = [];
      if (liveMember?.cls && typeof liveMember.cls === 'object') {
        Object.entries(liveMember.cls).forEach(([cid, statusObj]) => {
          if (statusObj && typeof statusObj === 'object' && (statusObj as any).st === 1) {
            const numCid = Number(cid);
            if (!isNaN(numCid)) completedChallengeIds.push(numCid);
          }
        });
      }

      // 4. Calculate points using challenge rules (with live penalty guard and max continuous trap)
      const calculated = calculatePointsFromRules(
        peakHours,
        challenge.rules,
        foundStat?.detectedRules?.map((r) => r.emoji || '') || [],
        false,
        completedChallengeIds,
        applyPenalty,
        peakMaxContMs
      );

      const appliedRules = (calculated.appliedRules || []).map((r) => ({
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        emoji: r.emoji || '⭐',
        points: r.points || 0,
      }));

      const intervalVal = challenge.rules?.studyIntervalValue ?? 1;
      const intervalUnit = challenge.rules?.studyIntervalUnit ?? 'hours';
      const intervalHours = intervalUnit === 'minutes' ? intervalVal / 60 : intervalVal || 1;
      const ptsPerInterval = challenge.rules?.pointsPerInterval ?? challenge.rules?.pointsPerStudyHour ?? 1;
      const basePoints = Math.floor(peakHours / (intervalHours || 1)) * ptsPerInterval;

      const bonusPoints = appliedRules
        .filter((r) => r.points > 0)
        .reduce((acc, r) => acc + r.points, 0);
      const penaltyPoints = appliedRules
        .filter((r) => r.points < 0)
        .reduce((acc, r) => acc + Math.abs(r.points), 0);

      const netPoints = calculated.totalPoints;

      const appliedRuleBreakdown = appliedRules.map((r) => ({
        ruleId: r.ruleId || '',
        ruleName: r.ruleName,
        emoji: r.emoji,
        points: r.points,
        type: (r.points < 0 ? 'penalty' : r.points > 0 ? 'bonus' : 'base') as 'bonus' | 'penalty' | 'base' | 'milestone',
      }));

      memberSnapshots[cleanHandle] = {
        handle: foundStat?.memberHandle || liveMember?.n || p.yptHandle || cleanHandle,
        rawYptUd: liveMember?.ud || p.yptUd,
        appUserId: p.appUserId,
        hoursStudied: peakHours,
        studyMs: Math.round(peakHours * 3600000),
        maxContinuousMs: peakMaxContMs,
        isCurrentlyStudying: Boolean(liveMember?.dl?.is),
        completedNativeChallengeIds: completedChallengeIds,
        basePoints,
        bonusPoints,
        penaltyPoints,
        netPoints,
        appliedRuleBreakdown,
        status: 'active',
        lastSyncedAt: new Date().toISOString(),
      };

      memberRecords.push({
        yptHandle: foundStat?.memberHandle || cleanHandle,
        userId: foundStat?.matchedUid || (liveMember?.ud ? String(liveMember.ud) : p.yptUd ? String(p.yptUd) : undefined),
        hoursStudied: peakHours,
        basePoints,
        bonusPoints,
        penaltyPoints,
        netPoints,
        isCurrentlyStudying: Boolean(liveMember?.dl?.is),
        appliedRules,
        completedChallengeIds,
      });

      dayTotalPoints += netPoints;
    });

    const participantDraft = Object.values(memberSnapshots).map((m: any) => ({
      yptUd: m.rawYptUd,
      yptHandle: m.handle,
      appUserId: m.appUserId,
      dayHours: m.hoursStudied || 0,
      dayPoints: m.netPoints || 0,
    }));
    participantDraft.sort((a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours);
    participantStandings = participantDraft.map((p, idx) => ({ ...p, rank: idx + 1 }));
  } else {
    (challenge.teams || []).forEach((team) => {
      let teamDailyPoints = 0;
      let teamDailyHours = 0;

      (team.memberUids || []).forEach((memberHandleOrUid) => {
        const cleanHandle = memberHandleOrUid.replace(/^@/, '').trim().toLowerCase();

        // Find manual submission stat (if any)
        const foundStat = statsForDate.find((s) =>
          areYptHandlesMatching(s.memberHandle, memberHandleOrUid, s.matchedUid)
        );

        // Find member in live API roster
        const liveMember = (liveRoster || []).find((m) => {
          if (!m) return false;
          const mHandle = (m.n || '').replace(/^@/, '').trim();
          const mUid = m.ud ? String(m.ud) : undefined;
          return areYptHandlesMatching(mHandle, memberHandleOrUid, mUid);
        });

        // 1. Calculate incoming hours from API
        const apiLiveHours = liveMember ? getMemberStudyHoursFromApi(liveMember) : 0;
        const manualHours = foundStat ? foundStat.hoursStudied || 0 : 0;

        // 2. High-Water Mark for total hours: Math.max(previous recorded HWM, apiLiveHours, manualHours)
        const prevHwm = existingHwms[cleanHandle] ?? 0;
        const peakHours = applyHighWaterMark(prevHwm, Math.max(apiLiveHours, manualHours));
        updatedHwms[cleanHandle] = peakHours;

        // 2b. High-Water Mark for max continuous session (ms): Math.max(prev HWM, api live mm, manual mm)
        const apiLiveMaxContMs = (liveMember?.dl && typeof liveMember.dl.mm === 'number') ? liveMember.dl.mm : 0;
        const manualMaxContMs = foundStat?.maxContinuousMs || 0;
        const prevMaxContHwm = existingMaxContHwms[cleanHandle] ?? 0;
        const peakMaxContMs = Math.max(prevMaxContHwm, apiLiveMaxContMs, manualMaxContMs);
        updatedMaxContHwms[cleanHandle] = peakMaxContMs;

        if (peakHours > 0) activeMemberCount++;
        dayTotalHours += peakHours;
        teamDailyHours += peakHours;

        // 3. Extract completed native challenges
        const completedChallengeIds: number[] = [];
        if (liveMember?.cls && typeof liveMember.cls === 'object') {
          Object.entries(liveMember.cls).forEach(([cid, statusObj]) => {
            if (statusObj && typeof statusObj === 'object' && (statusObj as any).st === 1) {
              const numCid = Number(cid);
              if (!isNaN(numCid)) completedChallengeIds.push(numCid);
            }
          });
        }

        // 4. Calculate points using challenge rules (with live penalty guard and max continuous trap)
        const calculated = calculatePointsFromRules(
          peakHours,
          challenge.rules,
          foundStat?.detectedRules?.map((r) => r.emoji || '') || [],
          false,
          completedChallengeIds,
          applyPenalty,
          peakMaxContMs
        );

        const appliedRules = (calculated.appliedRules || []).map((r) => ({
          ruleId: r.ruleId,
          ruleName: r.ruleName,
          emoji: r.emoji || '⭐',
          points: r.points || 0,
        }));

        const intervalVal = challenge.rules?.studyIntervalValue ?? 1;
        const intervalUnit = challenge.rules?.studyIntervalUnit ?? 'hours';
        const intervalHours = intervalUnit === 'minutes' ? intervalVal / 60 : intervalVal || 1;
        const ptsPerInterval = challenge.rules?.pointsPerInterval ?? challenge.rules?.pointsPerStudyHour ?? 1;
        const basePoints = Math.floor(peakHours / (intervalHours || 1)) * ptsPerInterval;

        const bonusPoints = appliedRules
          .filter((r) => r.points > 0)
          .reduce((acc, r) => acc + r.points, 0);
        const penaltyPoints = appliedRules
          .filter((r) => r.points < 0)
          .reduce((acc, r) => acc + Math.abs(r.points), 0);

        const netPoints = calculated.totalPoints;

        const appliedRuleBreakdown = appliedRules.map((r) => ({
          ruleId: r.ruleId || '',
          ruleName: r.ruleName,
          emoji: r.emoji,
          points: r.points,
          type: (r.points < 0 ? 'penalty' : r.points > 0 ? 'bonus' : 'base') as 'bonus' | 'penalty' | 'base' | 'milestone',
        }));

        memberSnapshots[cleanHandle] = {
          handle: foundStat?.memberHandle || cleanHandle,
          rawYptUd: liveMember?.ud,
          hoursStudied: peakHours,
          studyMs: Math.round(peakHours * 3600000),
          maxContinuousMs: peakMaxContMs,
          isCurrentlyStudying: Boolean(liveMember?.dl?.is),
          completedNativeChallengeIds: completedChallengeIds,
          basePoints,
          bonusPoints,
          penaltyPoints,
          netPoints,
          appliedRuleBreakdown,
          status: 'active',
          lastSyncedAt: new Date().toISOString(),
        };

        memberRecords.push({
          yptHandle: foundStat?.memberHandle || cleanHandle,
          userId: foundStat?.matchedUid || (liveMember?.ud ? String(liveMember.ud) : undefined),
          teamId: team.id,
          hoursStudied: peakHours,
          basePoints,
          bonusPoints,
          penaltyPoints,
          netPoints,
          isCurrentlyStudying: Boolean(liveMember?.dl?.is),
          appliedRules,
          completedChallengeIds,
        });

        teamDailyPoints += netPoints;
      });

      teamPointsMap[team.id] = teamDailyPoints;
      dayTotalPoints += teamDailyPoints;

      teamStandingsDraft.push({
        teamId: team.id,
        teamName: team.name || `Team ${team.id}`,
        dayHours: teamDailyHours,
        dayPoints: teamDailyPoints,
      });
    });
  }

  // Rank teams descending by dayPoints, then dayHours
  teamStandingsDraft.sort((a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours);
  const teamStandings = teamStandingsDraft.map((t, idx) => ({
    ...t,
    rank: idx + 1,
  }));

  const snapshot: YptDailyDaySnapshot = {
    id: activeYmd,
    challengeId: challenge.id,
    dateYmd: activeYmd,
    targetDateYmd: activeYmd,
    isLocked: forceFinalLock,
    lockedAt: forceFinalLock ? new Date().toISOString() : undefined,
    lockedBy: forceFinalLock ? 'admin_manual' : undefined,
    totalChallengeHours: dayTotalHours,
    totalChallengePoints: dayTotalPoints,
    activeMemberCount,
    memberSnapshots,
    teamStandings: isSoloMode ? [] : teamStandings,
    participantStandings: isSoloMode ? participantStandings : undefined,
    isAutoClosed: forceFinalLock,
    closedAt: Date.now(),
    totalPointsAwarded: dayTotalPoints,
    teamPointsMap,
    highWaterMarks: updatedHwms,
    maxContinuousHighWaterMarks: updatedMaxContHwms,
    memberRecords,
  };

  await saveDailySnapshot(challenge.id, snapshot);

  if (forceFinalLock) {
    await recalculateTeamPointsFromSubmissions(challenge.id);
  }

  return snapshot;
}

/**
 * Manually locks and finalizes a day snapshot for a given challenge and date.
 * Allows an admin or challenge creator to freeze scores on-demand.
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
 * Synchronizes historical study logs from YPT (GET /logs/day?date=YYYY-MM-DD) into the challenge,
 * creating/updating submission logs and refreshing snapshots so real study hours are preserved.
 */
export async function syncDayLogToChallenge(
  challenge: YptChallenge,
  dateYmd: string,
  targetHandle?: string
): Promise<{ success: boolean; hours: number; memberHandle: string; message: string; subjects?: any[] }> {
  if (!challenge || !challenge.id) {
    throw new Error('Invalid challenge object');
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
      memberHandle: targetHandle || 'User',
      message: `YPT returned 0:00 study time for ${dateYmd}.`,
      subjects: dayLog.subjects,
    };
  }

  // Determine which challenge member handle to associate
  let matchedHandle = targetHandle ? targetHandle.replace(/^@/, '').trim() : '';
  if (!matchedHandle && challenge.teams && challenge.teams.length > 0) {
    for (const team of challenge.teams) {
      if (team.memberUids && team.memberUids.length > 0) {
        matchedHandle = team.memberUids[0].replace(/^@/, '').trim();
        break;
      }
    }
  }

  const calculated = calculatePointsFromRules(hours, challenge.rules, [], false, [], true);

  const appliedRulesList = (calculated.appliedRules || []).map((r) => ({
    ruleId: r.ruleId || 'rule',
    ruleName: r.ruleName,
    emoji: r.emoji || '⭐',
    points: r.points || 0,
  }));

  // Write the verified submission log for this date
  await addYptSubmissionLog(challenge.id, {
    dateYmd,
    targetDateYmd: dateYmd,
    uploaderUid: auth.currentUser?.uid || 'system',
    imageUrl: '',
    extractedMembers: [
      {
        yptHandle: matchedHandle || 'User',
        hoursStudied: hours,
        morningSnap: false,
        pointsEarned: calculated.totalPoints,
        detectedRules: appliedRulesList,
      },
    ],
    totalPointsAwarded: calculated.totalPoints,
    source: 'ypt_api',
    status: 'verified',
  });

  // Re-lock or update the snapshot for this date
  await lockDaySnapshot(challenge, dateYmd);

  const formattedHours = `${Math.floor(hours)}h ${String(Math.round((hours % 1) * 60)).padStart(2, '0')}m`;
  return {
    success: true,
    hours,
    memberHandle: matchedHandle || 'User',
    message: `Successfully synced ${formattedHours} (${calculated.totalPoints} XP) from YPT for ${dateYmd}!`,
    subjects: dayLog.subjects,
  };
}

/**
 * Retrieves the configured continuous auto-sync interval in minutes (defaults to 15).
 */
export async function getYptSyncInterval(): Promise<number> {
  try {
    const { getDoc, doc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'system', 'settings'));
    if (snap.exists()) {
      const data = snap.data();
      if (data?.yptSyncIntervalMinutes && !isNaN(Number(data.yptSyncIntervalMinutes))) {
        return Number(data.yptSyncIntervalMinutes);
      }
    }
    const hubSnap = await getDoc(doc(db, 'yptChallenges', 'hub_settings'));
    if (hubSnap.exists()) {
      const data = hubSnap.data();
      if (data?.yptSyncIntervalMinutes && !isNaN(Number(data.yptSyncIntervalMinutes))) {
        return Number(data.yptSyncIntervalMinutes);
      }
    }
  } catch (err) {
    console.warn('Could not fetch YPT sync interval from Firestore:', err);
  }
  return 15;
}

/**
 * Saves the new YPT continuous auto-sync interval in minutes across Firestore settings.
 */
export async function saveYptSyncInterval(intervalMinutes: number): Promise<{ success: boolean; intervalMinutes: number }> {
  const safeMinutes = Math.max(1, Math.min(1440, Number(intervalMinutes) || 15));
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    await Promise.allSettled([
      setDoc(doc(db, 'system', 'settings'), { yptSyncIntervalMinutes: safeMinutes }, { merge: true }),
      setDoc(doc(db, 'yptChallenges', 'hub_settings'), { yptSyncIntervalMinutes: safeMinutes }, { merge: true }),
    ]);

    // Also inform the backend API if running
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        await fetch('/api/admin/ypt/sync-interval', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ intervalMinutes: safeMinutes }),
        });
      }
    } catch {}

    return { success: true, intervalMinutes: safeMinutes };
  } catch (err: any) {
    console.error('Failed to save YPT sync interval:', err);
    throw err;
  }
}

/**
 * Triggers an immediate execution of the background continuous High-Water Mark sync.
 */
export async function triggerContinuousYptSync(): Promise<{ success: boolean; message: string }> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Authentication required');

    const res = await fetch('/api/admin/ypt/trigger-continuous-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to trigger continuous sync');
    }

    return { success: true, message: 'Continuous YPT sync executed successfully!' };
  } catch (err: any) {
    console.error('Trigger continuous YPT sync error:', err);
    throw err;
  }
}




