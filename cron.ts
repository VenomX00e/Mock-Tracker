import cron from "node-cron";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import { initFirebaseAdmin, getAdminDb as getUnifiedAdminDb, getFirebaseConfig } from "./firebase-admin-init.js";

const firebaseConfig = getFirebaseConfig();
const { db: initializedDb } = initFirebaseAdmin();
const db = initializedDb;

// Helper to calculate stats safely
function calculateUserStats(mocks: any[]) {
    let sumP = 0, pCount = 0;
    
    mocks.forEach(m => {
        if ((!m.examScope || m.examScope === 'Full') && m.percentile != null && !isNaN(m.percentile) && m.percentile > 0) {
            sumP += m.percentile;
            pCount++;
        }
    });
    
    return {
        avgPercentile: pCount > 0 ? Number((sumP / pCount).toFixed(2)) : 0,
        totalTests: mocks.length,
    };
}

/**
 * Returns Date object in Indian Standard Time (IST, UTC+5:30).
 */
function getIstDateNode(dateInput: Date | string | number = new Date()): Date {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return new Date();
  const utcMs = d.getTime();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(utcMs + istOffsetMs);
}

/**
 * Returns current YPT calendar date string (YYYY-MM-DD) based on 05:00 AM IST boundary.
 */
function getYptDayYmdNode(dateInput: Date | string | number = new Date()): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return getYptDayYmdNode(new Date());

  const utcMs = d.getTime();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const rolloverOffsetMs = -5 * 60 * 60 * 1000;
  const shiftedMs = utcMs + istOffsetMs + rolloverOffsetMs;

  const shiftedDate = new Date(shiftedMs);
  const yyyy = shiftedDate.getUTCFullYear();
  const mm = String(shiftedDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shiftedDate.getUTCDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns yesterday's YPT calendar date string relative to current YPT date.
 */
function getYesterdayYptDayYmdNode(dateInput: Date | string | number = new Date()): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return getYesterdayYptDayYmdNode(new Date());

  const utcMs = d.getTime();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const rolloverOffsetMs = -5 * 60 * 60 * 1000;
  const previousDayOffsetMs = -24 * 60 * 60 * 1000;
  const shiftedMs = utcMs + istOffsetMs + rolloverOffsetMs + previousDayOffsetMs;

  const shiftedDate = new Date(shiftedMs);
  const yyyy = shiftedDate.getUTCFullYear();
  const mm = String(shiftedDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shiftedDate.getUTCDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Safely extracts YYYY-MM-DD from any date, string, or Firestore timestamp object.
 */
function getYmdFromDateOrStringNode(val: any): string {
  if (!val) return getYptDayYmdNode();
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  if (typeof val === 'object' && val !== null) {
    if (typeof val.toDate === 'function') {
      const d = val.toDate();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    if (typeof val.seconds === 'number') {
      const d = new Date(val.seconds * 1000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return getYptDayYmdNode();
}

/**
 * Returns challenge end date YYYY-MM-DD string.
 */
function getChallengeEndDateYmdNode(ch?: { endDate?: any } | null): string {
  if (!ch || !ch.endDate) return getYptDayYmdNode();
  return getYmdFromDateOrStringNode(ch.endDate);
}

/**
 * Normalizes YPT username/handle for comparison.
 */
function normalizeHandleNode(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/^@/, '')
    .normalize('NFKC')
    .replace(/[\uFE00-\uFE0F\u200B-\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Compares two handles with multi-tier matching.
 */
function areHandlesMatchingNode(handleA?: string, handleB?: string, uidA?: string, uidB?: string): boolean {
  if (uidA && uidB && String(uidA).trim() === String(uidB).trim()) return true;
  if (!handleA || !handleB) return false;
  const normA = normalizeHandleNode(handleA);
  const normB = normalizeHandleNode(handleB);
  if (normA === normB) return true;
  const noSpaceA = normA.replace(/\s+/g, '');
  const noSpaceB = normB.replace(/\s+/g, '');
  if (noSpaceA && noSpaceA === noSpaceB) return true;
  return false;
}

// Token cache for background YPT cron requests
let nodeYptTokenCache: { token: string; coid: string; expiresAt: number } | null = null;

/**
 * Authenticates with YPT API on backend using environment variables, system settings, or fallback.
 * Implements Phase 2: Autonomous Backend Authentication:
 * 1. Checks environment variables YPT_JWT / YPT_TOKEN / YPT_EMAIL / YPT_PASSWORD
 * 2. If credentials are in env or Firestore, performs POST https://pi.tgclab.com/user/sign-in-jwt
 * 3. Extracts JWT and Country ID (coid). If coid is 0 or missing, queries /user/v2/reload/info or defaults to "89" (India) to prevent YPT HTTP 500.
 */
async function getYptAuthTokenNode(adminDb?: any): Promise<{ token: string; coid: string } | null> {
  const now = Date.now();
  if (nodeYptTokenCache && nodeYptTokenCache.expiresAt > now) {
    return { token: nodeYptTokenCache.token, coid: nodeYptTokenCache.coid };
  }

  const explicitJwt = process.env.YPT_JWT || process.env.YPT_TOKEN;
  const configuredCoid = process.env.YPT_COID || "89";
  if (explicitJwt) {
    nodeYptTokenCache = { token: explicitJwt, coid: configuredCoid, expiresAt: now + 60 * 60 * 1000 };
    return nodeYptTokenCache;
  }

  let email = (process.env.YPT_EMAIL || "").trim();
  let password = process.env.YPT_PASSWORD || "";

  // Fallback: If env vars are absent, check Firestore system/ypt config document
  if ((!email || !password) && adminDb) {
    try {
      const yptSysDoc = await adminDb.collection("system").doc("ypt").get();
      if (yptSysDoc.exists) {
        const sysData = yptSysDoc.data();
        if (sysData?.jwt) {
          nodeYptTokenCache = {
            token: sysData.jwt,
            coid: String(sysData.coid || sysData.countryId || configuredCoid),
            expiresAt: now + 60 * 60 * 1000,
          };
          return nodeYptTokenCache;
        }
        if (sysData?.email && sysData?.password) {
          email = String(sysData.email).trim();
          password = String(sysData.password);
        }
      }
    } catch (_dbErr) {}
  }

  if (!email || !password || email === "bot@example.com" || password === "YOUR_YPT_PASSWORD" || !email.includes("@")) {
    return null;
  }

  const md5Pass = crypto.createHash("md5").update(password).digest("hex");
  const sha256Pass = crypto.createHash("sha256").update(password).digest("hex");
  const passwordVariants = [password, md5Pass, sha256Pass];

  for (const passVar of passwordVariants) {
    try {
      const loginRes = await fetch("https://pi.tgclab.com/user/sign-in-jwt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Dart/3.11 (dart:io)",
          Accept: "application/json",
          "Accept-Encoding": "gzip",
        },
        body: JSON.stringify({
          email,
          password: passVar,
          loginProvider: "Email",
          new: true,
          getx: true,
          language: "en",
        }),
      });

      if (!loginRes.ok) continue;
      const data: any = await loginRes.json();
      if (!data || data.s === false) continue;

      const token = data.jwt || data.access_token || data.token;
      let coid = data.coid || data.country_id;

      if (token) {
        // Crucial: If coid is missing, 0, or null, query /user/v2/reload/info to get the real country ID
        if (!coid || coid === "0" || coid === 0) {
          try {
            const infoRes = await fetch("https://pi.tgclab.com/user/v2/reload/info", {
              method: "POST",
              headers: {
                authorization: `JWT ${token}`,
                "User-Agent": "Dart/3.11 (dart:io)",
                "Content-Type": "application/json",
                "Accept-Encoding": "gzip",
              },
              body: JSON.stringify({
                pv: 0,
                cd: { su: null, sbu: null, cu: null, eu: null, du: null, tu: null },
              }),
            });
            if (infoRes.ok) {
              const infoData = await infoRes.json();
              if (infoData && (infoData.coid || infoData.country_id)) {
                coid = infoData.coid || infoData.country_id;
              }
            }
          } catch (_e) {}
        }

        // Default coid to "89" (India) if still absent/zero to prevent YPT HTTP 500
        const resolvedCoid = String(coid && coid !== "0" && coid !== 0 ? coid : (process.env.YPT_COID || "89"));

        nodeYptTokenCache = {
          token,
          coid: resolvedCoid,
          expiresAt: now + 50 * 60 * 1000,
        };
        return nodeYptTokenCache;
      }
    } catch (_err) {}
  }

  return null;
}

/**
 * Fetches group roster directly from YPT API for specified group IDs.
 */
async function fetchYptRosterForChallengeNode(groupIds: (string | number)[], adminDb?: any): Promise<{ members: any[]; nativeChallenges: any[]; errors: string[] }> {
  const errors: string[] = [];
  const auth = await getYptAuthTokenNode(adminDb);
  if (!auth) {
    const errMsg = "YPT authentication failed: No valid YPT credentials found or login rejected by pi.tgclab.com.";
    console.warn(`[YPT Cron] ${errMsg}`);
    errors.push(errMsg);
    return { members: [], nativeChallenges: [], errors };
  }

  const yptHeaders = {
    authorization: `JWT ${auth.token}`,
    "User-Agent": "Dart/3.11 (dart:io)",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Accept-Encoding": "gzip",
    coid: String(auth.coid),
  };

  let gids = groupIds.map(String).filter(Boolean);
  if (gids.length === 0) {
    try {
      const gRes = await fetch("https://pi.tgclab.com/group/groups/v2", { headers: yptHeaders });
      if (gRes.ok) {
        const gData: any = await gRes.json();
        const rawGroups = [...(gData.gs || []), ...(gData.ms || []), ...(gData.cs || []), ...(gData.ps || [])];
        gids = rawGroups.map((g: any) => String(g.id)).filter(Boolean);
      } else {
        errors.push(`Failed to fetch user groups list from YPT: HTTP ${gRes.status} ${gRes.statusText}`);
      }
    } catch (gErr: any) {
      errors.push(`Network error fetching YPT groups list: ${gErr?.message || String(gErr)}`);
    }
  }

  if (gids.length === 0) {
    if (errors.length === 0) {
      errors.push("No YPT group IDs specified in challenge configuration or associated with bot account.");
    }
    return { members: [], nativeChallenges: [], errors };
  }

  const allMembers: any[] = [];
  const rawChallenges: any[] = [];

  await Promise.all(
    gids.map(async (gid) => {
      try {
        const mUrl = `https://pi.tgclab.com/logs/group/members/v2?groupID=${encodeURIComponent(gid)}&countryID=${encodeURIComponent(auth.coid)}&isLooking=true&version=810046`;
        const mRes = await fetch(mUrl, { headers: yptHeaders });
        if (mRes.ok) {
          const mData: any = await mRes.json();
          if (Array.isArray(mData.ms)) {
            allMembers.push(...mData.ms);
            for (const m of mData.ms) {
              if (m?.cls) {
                if (typeof m.cls === 'object' && !Array.isArray(m.cls)) {
                  for (const [chIdStr, chItem] of Object.entries(m.cls)) {
                    const chId = Number(chIdStr);
                    if (chId && !isNaN(chId)) {
                      rawChallenges.push({ id: chId, ...(typeof chItem === 'object' ? chItem : {}) });
                    }
                  }
                }
              }
            }
          }
        } else {
          const errText = `Failed to fetch YPT group ${gid}: HTTP ${mRes.status} ${mRes.statusText}`;
          console.warn(`[YPT Cron] ${errText}`);
          errors.push(errText);
        }
      } catch (err: any) {
        const errText = `Network error fetching YPT group ${gid}: ${err?.message || String(err)}`;
        console.warn(`[YPT Cron] ${errText}`);
        errors.push(errText);
      }
    })
  );

  // Deduplicate members
  const memberMap = new Map();
  for (const m of allMembers) {
    const key = m.ud || m.n;
    if (key && !memberMap.has(key)) {
      memberMap.set(key, m);
    }
  }

  return {
    members: Array.from(memberMap.values()),
    nativeChallenges: rawChallenges,
    errors,
  };
}

/**
 * Calculates study points and custom rule bonuses/penalties for a member.
 */
function calculatePointsFromRulesNode(
  hoursStudied: number,
  rules: any = {},
  detectedEmojis: string[] = [],
  completedNativeChallengeIds: number[] = [],
  applyPenalty: boolean = true,
  maxContinuousMs: number = 0
): {
  baseStudyPoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  netPoints: number;
  appliedRules: Array<{ ruleId: string; ruleName: string; emoji: string; points: number; type: 'bonus' | 'penalty' | 'base' | 'milestone' }>;
} {
  const intervalVal = rules.studyIntervalValue ?? 1;
  const intervalUnit = rules.studyIntervalUnit ?? 'hours';
  const intervalHours = intervalUnit === 'minutes' ? intervalVal / 60 : intervalVal || 1;
  const ptsPerInterval = rules.pointsPerInterval ?? rules.pointsPerStudyHour ?? 1;

  const baseStudyPoints = Math.floor(hoursStudied / (intervalHours || 1)) * ptsPerInterval;

  const penaltyThresholdVal = rules.penaltyThresholdValue ?? rules.noStudyPenaltyThresholdHours ?? 3;
  const penaltyThresholdUnit = rules.penaltyThresholdUnit ?? 'hours';
  const penaltyThresholdHours = penaltyThresholdUnit === 'minutes' ? penaltyThresholdVal / 60 : penaltyThresholdVal || 3;

  const isPenalized = applyPenalty && hoursStudied < penaltyThresholdHours;
  const penaltyPoints = isPenalized ? (rules.penaltyPoints || 0) : 0;

  const appliedRules: Array<{ ruleId: string; ruleName: string; emoji: string; points: number; type: 'bonus' | 'penalty' | 'base' | 'milestone' }> = [];
  let bonusPoints = 0;
  let customPenaltySum = 0;

  if (baseStudyPoints > 0) {
    appliedRules.push({
      ruleId: 'base_study',
      ruleName: 'Study Interval Points',
      emoji: '⏱️',
      points: baseStudyPoints,
      type: 'base',
    });
  }

  if (Array.isArray(rules.customRules)) {
    for (const cr of rules.customRules) {
      let isMet = false;
      const targetHours = Number(cr.targetHours || cr.hours) || 0;
      const targetMins = Number(cr.targetMinutes || cr.minutes) || 0;
      const effectiveTargetHours = targetHours + (targetMins / 60);

      if (cr.type === 'milestone') {
        isMet = effectiveTargetHours > 0 && hoursStudied >= effectiveTargetHours;
      } else if (cr.criteriaType === 'study_hours' || cr.category === 'study_hours') {
        isMet = effectiveTargetHours > 0 && hoursStudied >= effectiveTargetHours;
      } else if (cr.criteriaType === 'native_challenge' || cr.category === 'native_challenge') {
        const targetCid = Number(cr.nativeChallengeId || cr.challengeId);
        isMet = targetCid > 0 && completedNativeChallengeIds.includes(targetCid);
      } else if (cr.emoji) {
        isMet = detectedEmojis.includes(cr.emoji);
      }

      if (isMet) {
        const p = Number(cr.points) || 0;
        if (cr.type === 'bonus' || cr.type === 'milestone') {
          bonusPoints += p;
          appliedRules.push({
            ruleId: cr.id || '',
            ruleName: cr.name || 'Bonus Rule',
            emoji: cr.emoji || '⭐',
            points: p,
            type: cr.type === 'milestone' ? 'milestone' : 'bonus',
          });
        } else if (cr.type === 'penalty') {
          customPenaltySum += p;
          appliedRules.push({
            ruleId: cr.id || '',
            ruleName: cr.name || 'Penalty Rule',
            emoji: cr.emoji || '⚠️',
            points: -p,
            type: 'penalty',
          });
        }
      }
    }
  }

  if (isPenalized && penaltyPoints > 0) {
    appliedRules.push({
      ruleId: 'min_hours_penalty',
      ruleName: 'Threshold Penalty',
      emoji: '⚠️',
      points: -penaltyPoints,
      type: 'penalty',
    });
  }

  // Evaluate the Fake Session / Max Continuous Trap
  let maxContinuousPenaltyDeduction = 0;
  const maxContThreshold = rules.maxContinuousHoursThreshold;
  if (typeof maxContThreshold === 'number' && maxContThreshold > 0 && maxContinuousMs > 0) {
    const maxContHours = maxContinuousMs / 3600000;
    if (maxContHours > maxContThreshold) {
      const penaltyType = rules.maxContinuousPenaltyType || 'variable';

      if (penaltyType === 'fixed') {
        const fixedDeduction = typeof rules.maxContinuousFixedPenalty === 'number' ? rules.maxContinuousFixedPenalty : 0;
        if (fixedDeduction > 0) {
          maxContinuousPenaltyDeduction = fixedDeduction;
          appliedRules.push({
            ruleId: 'max_continuous_fake_session_penalty',
            ruleName: `Fake Session Penalty (>${maxContThreshold}hrs - Flat Deduction)`,
            emoji: '🚨',
            points: -fixedDeduction,
            type: 'penalty',
          });
        }
      } else {
        const mode = rules.maxContinuousPenaltyMode || 'excess';
        const targetHours = mode === 'whole' ? maxContHours : maxContHours - maxContThreshold;

        if (targetHours > 0) {
          const multiplier = rules.maxContinuousPenaltyMultiplier ?? 1;
          const baseTargetPoints = Math.floor(targetHours / (intervalHours || 1)) * ptsPerInterval;
          const calculatedPenalty = Math.max(0, baseTargetPoints * multiplier);

          if (calculatedPenalty > 0) {
            maxContinuousPenaltyDeduction = calculatedPenalty;
            appliedRules.push({
              ruleId: 'max_continuous_fake_session_penalty',
              ruleName: `Fake Session Penalty (>${maxContThreshold}hrs)`,
              emoji: '🚨',
              points: -calculatedPenalty,
              type: 'penalty',
            });
          }
        }
      }
    }
  }

  const totalPenalty = penaltyPoints + customPenaltySum + maxContinuousPenaltyDeduction;
  const netPoints = baseStudyPoints + bonusPoints - totalPenalty;

  return {
    baseStudyPoints,
    bonusPoints,
    penaltyPoints: totalPenalty,
    netPoints,
    appliedRules,
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

/**
 * Regular 15-Minute Continuous Sync logic:
 * Updates the open snapshot with High-Water Mark peak hours and returns structured diagnostic logs.
 */
async function execute15MinYptSync(adminDb?: admin.firestore.Firestore): Promise<YptSyncDiagnosticReport> {
  const targetDb = adminDb || getUnifiedAdminDb();
  const startTimeMs = Date.now();
  const results: YptSyncDiagnosticResult[] = [];
  const errors: string[] = [];

  try {
    const activeYmd = getYptDayYmdNode();
    console.log(`[YPT 15-MIN CRON] Starting live sync for active date: ${activeYmd}...`);

    const challengesSnap = await targetDb.collection("yptChallenges").get();
    const activeChallenges = challengesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter((c) => !c.isDeleted && c.status !== 'completed');

    if (activeChallenges.length === 0) {
      return {
        success: true,
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTimeMs,
        results: [],
        errors: [],
      };
    }

    // Phase 4 Batching: Initialize a Firestore writeBatch to commit all updates across all active challenges simultaneously
    const writeBatch = targetDb.batch();
    let batchOperationCount = 0;

    for (const challenge of activeChallenges) {
      try {
        const challengeEndDateYmd = getChallengeEndDateYmdNode(challenge);
        if (activeYmd > challengeEndDateYmd) {
          // Current live study date has passed the challenge end date, skip continuous sync
          continue;
        }

        const groupIds = (challenge.groups || []).map((g: any) => g.id || g.gid || g)
          .concat(challenge.yptGroupId ? [challenge.yptGroupId] : [])
          .concat(challenge.groupIds || []);

        const rawGroupId = challenge.yptGroupId || (challenge.groups?.[0]?.id || challenge.groups?.[0]?.gid) || (challenge.groupIds?.[0]) || (groupIds.length > 0 ? groupIds[0] : null);
        const resolvedYptGroupId = rawGroupId ? (!isNaN(Number(rawGroupId)) ? Number(rawGroupId) : rawGroupId) : null;

        const { members: liveMembers, errors: rosterErrors } = await fetchYptRosterForChallengeNode(groupIds, adminDb);
        if (rosterErrors && rosterErrors.length > 0) {
          errors.push(...rosterErrors);
        }

        // Fetch existing snapshot & main challenge document to preserve High-Water Marks across stateless invocations
        let existingHwms: Record<string, number> = {};
        let existingMaxContHwms: Record<string, number> = {};
        let challengeDailyHwms: Record<string, number> = {};
        let challengeDailyMaxContHwms: Record<string, number> = {};

        const challengeDocRef = adminDb.collection("yptChallenges").doc(challenge.id);
        const freshChallengeDoc = await challengeDocRef.get();
        if (freshChallengeDoc.exists) {
          const chData = freshChallengeDoc.data() as any;
          if (chData?.dailyHighWaterMarks && typeof chData.dailyHighWaterMarks === 'object') {
            challengeDailyHwms = { ...chData.dailyHighWaterMarks };
          }
          if (chData?.dailyMaxContinuousHighWaterMarks && typeof chData.dailyMaxContinuousHighWaterMarks === 'object') {
            challengeDailyMaxContHwms = { ...chData.dailyMaxContinuousHighWaterMarks };
          }
        }

        const snapDocRef = challengeDocRef.collection("dailySnapshots").doc(activeYmd);
        const existingSnap = await snapDocRef.get();

        if (existingSnap.exists) {
          const sData = existingSnap.data() as any;
          if (sData.isLocked) {
            // Already locked, do not overwrite
            continue;
          }
          if (sData.highWaterMarks) {
            existingHwms = { ...sData.highWaterMarks };
          }
          if (sData.maxContinuousHighWaterMarks) {
            existingMaxContHwms = { ...sData.maxContinuousHighWaterMarks };
          }
          if (sData.memberSnapshots) {
            for (const [h, m] of Object.entries(sData.memberSnapshots)) {
              existingHwms[h] = Math.max(existingHwms[h] || 0, (m as any).hoursStudied || 0);
              existingMaxContHwms[h] = Math.max(existingMaxContHwms[h] || 0, (m as any).maxContinuousMs || 0);
            }
          }
        }

        const mode = challenge.mode || 'team';
        const isSoloMode = mode === 'individual';

        const updatedHwms: Record<string, number> = { ...existingHwms };
        const updatedMaxContHwms: Record<string, number> = { ...existingMaxContHwms };
        const updatedChallengeHwms: Record<string, number> = { ...challengeDailyHwms };
        const updatedChallengeMaxContHwms: Record<string, number> = { ...challengeDailyMaxContHwms };
        const memberSnapshots: Record<string, any> = {};
        const teamStandingsDraft: Array<{ teamId: string; teamName: string; dayHours: number; dayPoints: number }> = [];
        let participantStandings: Array<{ yptUd?: number; yptHandle: string; dayHours: number; dayPoints: number; rank: number }> = [];
        let dayTotalHours = 0;
        let dayTotalPoints = 0;
        let activeMemberCount = 0;

        const updatedParticipants: Array<{
          yptUd: number;
          yptHandle: string;
          hours: number;
          studyMs: number;
          isStudying: boolean;
          hasCompleted: boolean;
          completedChallengeIds: number[];
          lastSyncedAt: string;
        }> = [];

        if (isSoloMode) {
          // SOLO / INDIVIDUAL MODE: Process flat list of participating members
          const participantsList: Array<{ yptUd?: number; yptHandle: string }> =
            challenge.participants && challenge.participants.length > 0
              ? challenge.participants
              : liveMembers.map((m: any) => ({ yptUd: m.ud, yptHandle: m.n }));

          participantsList.forEach((p) => {
            const cleanHandle = (p.yptHandle || '').replace(/^@/, '').trim().toLowerCase();
            const memberUdStr = p.yptUd ? String(p.yptUd) : '';
            if (!cleanHandle && !memberUdStr) return;

            // Phase 3 Strict ID Matching: Loop through YPT roster array (ms[])
            // Match against Firestore challenge participant strictly via numeric ID if available: participant.ud === member.ud
            const liveMember = liveMembers.find((m: any) => {
              if (p.yptUd && m.ud && Number(m.ud) === Number(p.yptUd)) return true;
              if (memberUdStr && String(m.ud) === memberUdStr) return true;
              return areHandlesMatchingNode(m.n || m.nickname, cleanHandle, String(m.ud || ''));
            });

            const resolvedUd = liveMember?.ud || p.yptUd || 0;
            const resolvedUdKey = resolvedUd ? String(resolvedUd) : cleanHandle;

            let apiLiveSm = 0;
            let apiLiveHours = 0;
            let apiLiveMaxContMs = 0;
            const completedChallengeIds: number[] = [];
            let hasCompletedActiveChallenge = false;

            if (liveMember) {
              if (liveMember.dl && typeof liveMember.dl.sm === 'number') {
                apiLiveSm = liveMember.dl.sm;
                apiLiveHours = liveMember.dl.sm / 3600000;
              } else if (typeof liveMember.sm === 'number') {
                apiLiveSm = liveMember.sm;
                apiLiveHours = liveMember.sm / 3600000;
              }

              if (liveMember.dl && typeof liveMember.dl.mm === 'number') {
                apiLiveMaxContMs = liveMember.dl.mm;
              }

              // Phase 3 Challenge Status: Check the cls (challenge submission) dictionary in the YPT response
              // to see if they completed the specific active challenge (st === 1)
              if (liveMember.cls && typeof liveMember.cls === 'object') {
                for (const [cIdStr, cItem] of Object.entries(liveMember.cls)) {
                  if (cItem && (cItem as any).st === 1) {
                    const cNum = Number(cIdStr);
                    completedChallengeIds.push(cNum);
                    if (challenge.nativeYptChallengeId && Number(challenge.nativeYptChallengeId) === cNum) {
                      hasCompletedActiveChallenge = true;
                    }
                  }
                }
                // If no specific nativeYptChallengeId was configured, having any completed challenge counts as true
                if (!challenge.nativeYptChallengeId && completedChallengeIds.length > 0) {
                  hasCompletedActiveChallenge = true;
                }
              }
            }

            // Phase 1 & 3 High-Water Mark Calculation Logic:
            // peak_ms = Math.max(stored_peak_ms, member.dl.sm)
            // hours = peak_ms / 3600000
            const prevStoredSm = challengeDailyHwms[resolvedUdKey] || (existingHwms[cleanHandle] ? Math.round(existingHwms[cleanHandle] * 3600000) : 0);
            const peakSm = Math.max(prevStoredSm, apiLiveSm);
            updatedChallengeHwms[resolvedUdKey] = peakSm;

            const prevMaxContStored = challengeDailyMaxContHwms[resolvedUdKey] || existingMaxContHwms[cleanHandle] || 0;
            const peakMaxContMs = Math.max(prevMaxContStored, apiLiveMaxContMs);
            updatedChallengeMaxContHwms[resolvedUdKey] = peakMaxContMs;

            const peakHours = Math.round((peakSm / 3600000) * 100) / 100;
            updatedHwms[cleanHandle] = peakHours;
            updatedMaxContHwms[cleanHandle] = peakMaxContMs;

            if (peakHours > 0) activeMemberCount++;
            dayTotalHours += peakHours;

            // Compute points without penalties during active open day
            const calculated = calculatePointsFromRulesNode(
              peakHours,
              challenge.rules,
              [],
              completedChallengeIds,
              false, // No penalty during live open day
              peakMaxContMs
            );

            dayTotalPoints += calculated.netPoints;

            const isCurrentlyStudying = Boolean(liveMember?.dl?.is);

            // Phase 3 Constructing the Update: Build updatedParticipants record in memory
            updatedParticipants.push({
              yptUd: Number(resolvedUd) || 0,
              yptHandle: liveMember?.n || p.yptHandle || cleanHandle,
              hours: peakHours,
              studyMs: peakSm,
              isStudying: isCurrentlyStudying,
              hasCompleted: hasCompletedActiveChallenge,
              completedChallengeIds,
              lastSyncedAt: new Date().toISOString(),
            });

            const currentSnapshotItem = {
              handle: liveMember?.n || p.yptHandle || cleanHandle,
              nickname: liveMember?.n || p.yptHandle || cleanHandle,
              rawYptUd: resolvedUd,
              yptUd: resolvedUd,
              hoursStudied: peakHours,
              studyMs: peakSm,
              maxContinuousMs: peakMaxContMs,
              isCurrentlyStudying,
              isStudying: isCurrentlyStudying,
              completedNativeChallengeIds: completedChallengeIds,
              hasCompleted: hasCompletedActiveChallenge,
              basePoints: calculated.baseStudyPoints,
              bonusPoints: calculated.bonusPoints,
              penaltyPoints: 0,
              netPoints: calculated.netPoints,
              appliedRuleBreakdown: calculated.appliedRules,
              status: 'active',
              lastSyncedAt: new Date().toISOString(),
            };

            memberSnapshots[cleanHandle] = currentSnapshotItem;
            if (resolvedUdKey && resolvedUdKey !== cleanHandle) {
              memberSnapshots[resolvedUdKey] = currentSnapshotItem;
            }
          });

          // Build solo leaderboard participant standings sorted by dayPoints desc, then dayHours desc
          const seenMemberKeys = new Set<string>();
          const participantDraft = Object.values(memberSnapshots)
            .filter((m: any) => {
              const uniqueKey = m.rawYptUd ? `ud_${m.rawYptUd}` : `h_${m.handle}`;
              if (seenMemberKeys.has(uniqueKey)) return false;
              seenMemberKeys.add(uniqueKey);
              return true;
            })
            .map((m: any) => ({
              yptUd: m.rawYptUd,
              yptHandle: m.handle,
              dayHours: m.hoursStudied,
              dayPoints: m.netPoints,
            }));
          participantDraft.sort((a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours);
          participantStandings = participantDraft.map((p, idx) => ({ ...p, rank: idx + 1 }));
        } else {
          // TEAM MODE: Aggregate member snapshots into team rosters & standings
          (challenge.teams || []).forEach((team: any) => {
            let teamDailyHours = 0;
            let teamDailyPoints = 0;

            (team.memberUids || []).forEach((memberHandleOrUid: string) => {
              const cleanHandle = memberHandleOrUid.replace(/^@/, '').trim().toLowerCase();
              const isNumUid = !isNaN(Number(memberHandleOrUid));

              // Phase 3 Strict ID Matching for Team Roster
              const liveMember = liveMembers.find((m: any) => {
                if (isNumUid && m.ud && Number(m.ud) === Number(memberHandleOrUid)) return true;
                if (m.ud && String(m.ud) === memberHandleOrUid) return true;
                return areHandlesMatchingNode(m.n || m.nickname, cleanHandle, String(m.ud || ''));
              });

              const resolvedUd = liveMember?.ud || (isNumUid ? Number(memberHandleOrUid) : undefined);
              const resolvedUdKey = resolvedUd ? String(resolvedUd) : cleanHandle;

              let apiLiveSm = 0;
              let apiLiveHours = 0;
              let apiLiveMaxContMs = 0;
              const completedChallengeIds: number[] = [];
              let hasCompletedActiveChallenge = false;

              if (liveMember) {
                if (liveMember.dl && typeof liveMember.dl.sm === 'number') {
                  apiLiveSm = liveMember.dl.sm;
                  apiLiveHours = liveMember.dl.sm / 3600000;
                } else if (typeof liveMember.sm === 'number') {
                  apiLiveSm = liveMember.sm;
                  apiLiveHours = liveMember.sm / 3600000;
                }

                if (liveMember.dl && typeof liveMember.dl.mm === 'number') {
                  apiLiveMaxContMs = liveMember.dl.mm;
                }

                if (liveMember.cls && typeof liveMember.cls === 'object') {
                  for (const [cIdStr, cItem] of Object.entries(liveMember.cls)) {
                    if (cItem && (cItem as any).st === 1) {
                      const cNum = Number(cIdStr);
                      completedChallengeIds.push(cNum);
                      if (challenge.nativeYptChallengeId && Number(challenge.nativeYptChallengeId) === cNum) {
                        hasCompletedActiveChallenge = true;
                      }
                    }
                  }
                  if (!challenge.nativeYptChallengeId && completedChallengeIds.length > 0) {
                    hasCompletedActiveChallenge = true;
                  }
                }
              }

              // Phase 1 & 3 High-Water Mark Calculation Logic
              const prevStoredSm = challengeDailyHwms[resolvedUdKey] || (existingHwms[cleanHandle] ? Math.round(existingHwms[cleanHandle] * 3600000) : 0);
              const peakSm = Math.max(prevStoredSm, apiLiveSm);
              updatedChallengeHwms[resolvedUdKey] = peakSm;

              const prevMaxContStored = challengeDailyMaxContHwms[resolvedUdKey] || existingMaxContHwms[cleanHandle] || 0;
              const peakMaxContMs = Math.max(prevMaxContStored, apiLiveMaxContMs);
              updatedChallengeMaxContHwms[resolvedUdKey] = peakMaxContMs;

              const peakHours = Math.round((peakSm / 3600000) * 100) / 100;
              updatedHwms[cleanHandle] = peakHours;
              updatedMaxContHwms[cleanHandle] = peakMaxContMs;

              if (peakHours > 0) activeMemberCount++;
              dayTotalHours += peakHours;
              teamDailyHours += peakHours;

              // Compute points without penalties during active open day
              const calculated = calculatePointsFromRulesNode(
                peakHours,
                challenge.rules,
                [],
                completedChallengeIds,
                false, // No penalty during live open day
                peakMaxContMs
              );

              teamDailyPoints += calculated.netPoints;

              const isCurrentlyStudying = Boolean(liveMember?.dl?.is);

              // Phase 3 Constructing the Update: Add to updatedParticipants
              updatedParticipants.push({
                yptUd: Number(resolvedUd) || 0,
                yptHandle: liveMember?.n || cleanHandle,
                hours: peakHours,
                studyMs: peakSm,
                isStudying: isCurrentlyStudying,
                hasCompleted: hasCompletedActiveChallenge,
                completedChallengeIds,
                lastSyncedAt: new Date().toISOString(),
              });

              memberSnapshots[cleanHandle] = {
                handle: liveMember?.n || cleanHandle,
                rawYptUd: resolvedUd,
                hoursStudied: peakHours,
                studyMs: peakSm,
                maxContinuousMs: peakMaxContMs,
                isCurrentlyStudying,
                completedNativeChallengeIds: completedChallengeIds,
                hasCompleted: hasCompletedActiveChallenge,
                basePoints: calculated.baseStudyPoints,
                bonusPoints: calculated.bonusPoints,
                penaltyPoints: 0,
                netPoints: calculated.netPoints,
                appliedRuleBreakdown: calculated.appliedRules,
                status: 'active',
                lastSyncedAt: new Date().toISOString(),
              };
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

        // Rank teams if in team mode
        teamStandingsDraft.sort((a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours);
        const teamStandings = teamStandingsDraft.map((t, idx) => ({ ...t, rank: idx + 1 }));

        const snapshotData: any = {
          id: activeYmd,
          challengeId: challenge.id,
          dateYmd: activeYmd,
          targetDateYmd: activeYmd,
          isLocked: false,
          totalChallengeHours: Math.round(dayTotalHours * 100) / 100,
          totalChallengePoints: dayTotalPoints,
          activeMemberCount,
          memberSnapshots,
          teamStandings: isSoloMode ? [] : teamStandings,
          participantStandings: isSoloMode ? participantStandings : undefined,
          highWaterMarks: updatedHwms,
          maxContinuousHighWaterMarks: updatedMaxContHwms,
          lastSyncedAt: new Date().toISOString(),
        };

        // Phase 4 Direct Firestore Write Execution via Batch:
        // 1. Stage canonical dailySnapshots write in batch
        writeBatch.set(snapDocRef, snapshotData, { merge: true });
        batchOperationCount++;

        // 2. Stage legacy daily_snapshots write in batch
        try {
          const legacyRef = adminDb.collection("yptChallenges").doc(challenge.id).collection("daily_snapshots").doc(`daily_${activeYmd}`);
          writeBatch.set(legacyRef, snapshotData, { merge: true });
          batchOperationCount++;
        } catch {}

        // 3. Phase 4 The Update Payload:
        // Direct write execution targeting doc(db, 'challenges' / 'yptChallenges', challengeId)
        // Includes:
        // - participants: The newly calculated array from Phase 3
        // - dailyHighWaterMarks: The updated peak times map from Phase 1
        // - lastCronSyncAt: Firestore FieldValue.serverTimestamp()
        const challengeUpdatePayload: any = {
          dailyHighWaterMarks: updatedChallengeHwms,
          dailyMaxContinuousHighWaterMarks: updatedChallengeMaxContHwms,
          lastDailySnapshotDate: activeYmd,
          lastSyncedAt: new Date().toISOString(),
          lastCronSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (updatedParticipants.length > 0) {
          challengeUpdatePayload.participants = updatedParticipants;
        }

        // Target doc(db, 'yptChallenges', challengeId)
        writeBatch.update(challengeDocRef, challengeUpdatePayload);
        batchOperationCount++;

        // Target doc(db, 'challenges', challengeId) to ensure universal reactivity across all client query patterns
        try {
          const altChallengeRef = adminDb.collection("challenges").doc(challenge.id);
          writeBatch.set(altChallengeRef, challengeUpdatePayload, { merge: true });
          batchOperationCount++;
        } catch {}

        // Phase 5 Diagnostic tracking per challenge
        results.push({
          challengeId: challenge.id,
          challengeName: challenge.title || challenge.name || "Untitled Challenge",
          yptGroupId: resolvedYptGroupId,
          participantsFound: liveMembers.length,
          participantsUpdated: updatedParticipants.length,
        });

        console.log(`[YPT 15-MIN CRON] Staged snapshot & challenge doc updates for challenge: ${challenge.title || challenge.name || challenge.id} (${activeYmd}).`);
      } catch (chErr: any) {
        const errDesc = `Error processing challenge ${challenge.id} (${challenge.title || challenge.name}): ${chErr?.message || String(chErr)}`;
        console.error(`[YPT 15-MIN CRON] ${errDesc}`, chErr);
        errors.push(errDesc);
      }
    }

    // Phase 4 Batch Commit: Commit all updates across all active challenges simultaneously
    if (batchOperationCount > 0) {
      await writeBatch.commit();
      console.log(`[YPT 15-MIN CRON] Phase 4 Batch Commit: Successfully committed ${batchOperationCount} write operations across ${activeChallenges.length} active challenge(s) simultaneously.`);
    }

    return {
      success: errors.length === 0,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTimeMs,
      results,
      errors,
    };
  } catch (err: any) {
    if (err && err.code === 7) {
      // Sandbox environment notice
    } else {
      console.error("[YPT 15-MIN CRON] Encountered unexpected error:", err);
    }
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
 * 5:15 AM IST Daily Finalizer & Day Transition Protocol:
 * - Runs daily at 5:15 AM IST (23:45 UTC).
 * - Finalizes yesterday's snapshot with full penalties and sets isLocked: true, lockedBy: 'cron_system'.
 * - Creates a fresh open snapshot for today.
 */
async function execute515AmYptFinalizer(adminDb: admin.firestore.Firestore) {
  try {
    const yesterdayYmd = getYesterdayYptDayYmdNode();
    const todayYmd = getYptDayYmdNode();
    console.log(`[YPT 5:15 AM IST FINALIZER] Executing Day Transition. Concluded: ${yesterdayYmd}, Fresh: ${todayYmd}...`);

    const challengesSnap = await adminDb.collection("yptChallenges").get();
    const activeChallenges = challengesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter((c) => !c.isDeleted && c.status !== 'completed');

    if (activeChallenges.length === 0) return;

    for (const challenge of activeChallenges) {
      try {
        const groupIds = (challenge.groups || []).map((g: any) => g.id || g.gid || g)
          .concat(challenge.yptGroupId ? [challenge.yptGroupId] : [])
          .concat(challenge.groupIds || []);

        const { members: liveMembers } = await fetchYptRosterForChallengeNode(groupIds, adminDb);

        // STEP A: Lock & Finalize Yesterday's Snapshot
        const challengeDocRef = adminDb.collection("yptChallenges").doc(challenge.id);
        const yesterdaySnapRef = challengeDocRef.collection("dailySnapshots").doc(yesterdayYmd);
        const yesterdaySnap = await yesterdaySnapRef.get();
        let existingHwms: Record<string, number> = {};
        let existingMaxContHwms: Record<string, number> = {};

        // Also retrieve main challenge doc dailyHighWaterMarks to prevent data loss across stateless restarts
        let challengeDailyHwms: Record<string, number> = {};
        let challengeDailyMaxContHwms: Record<string, number> = {};
        const freshChallengeDoc = await challengeDocRef.get();
        if (freshChallengeDoc.exists) {
          const chData = freshChallengeDoc.data() as any;
          if (chData?.dailyHighWaterMarks && typeof chData.dailyHighWaterMarks === 'object') {
            challengeDailyHwms = { ...chData.dailyHighWaterMarks };
          }
          if (chData?.dailyMaxContinuousHighWaterMarks && typeof chData.dailyMaxContinuousHighWaterMarks === 'object') {
            challengeDailyMaxContHwms = { ...chData.dailyMaxContinuousHighWaterMarks };
          }
        }

        if (yesterdaySnap.exists) {
          const sData = yesterdaySnap.data() as any;
          if (sData.highWaterMarks) existingHwms = { ...sData.highWaterMarks };
          if (sData.maxContinuousHighWaterMarks) existingMaxContHwms = { ...sData.maxContinuousHighWaterMarks };
          if (sData.memberSnapshots) {
            for (const [h, m] of Object.entries(sData.memberSnapshots)) {
              existingHwms[h] = Math.max(existingHwms[h] || 0, (m as any).hoursStudied || 0);
              existingMaxContHwms[h] = Math.max(existingMaxContHwms[h] || 0, (m as any).maxContinuousMs || 0);
            }
          }
        }

        const mode = challenge.mode || 'team';
        const isSoloMode = mode === 'individual';

        const finalizedMemberSnapshots: Record<string, any> = {};
        const teamStandingsDraft: Array<{ teamId: string; teamName: string; dayHours: number; dayPoints: number }> = [];
        let participantStandings: Array<{ yptUd?: number; yptHandle: string; dayHours: number; dayPoints: number; rank: number }> = [];
        let dayTotalHours = 0;
        let dayTotalPoints = 0;
        let activeMemberCount = 0;

        if (isSoloMode) {
          // SOLO / INDIVIDUAL MODE: Finalize member snapshots with penalties
          const participantsList: Array<{ yptUd?: number; yptHandle: string }> =
            challenge.participants && challenge.participants.length > 0
              ? challenge.participants
              : liveMembers.map((m: any) => ({ yptUd: m.ud, yptHandle: m.n }));

          participantsList.forEach((p) => {
            const cleanHandle = (p.yptHandle || '').replace(/^@/, '').trim().toLowerCase();
            const memberUdStr = p.yptUd ? String(p.yptUd) : '';
            if (!cleanHandle && !memberUdStr) return;

            const liveMember = liveMembers.find((m: any) =>
              (memberUdStr && String(m.ud) === memberUdStr) ||
              areHandlesMatchingNode(m.n || m.nickname, cleanHandle, String(m.ud || ''))
            );

            const resolvedUd = liveMember?.ud || p.yptUd;
            const resolvedUdKey = resolvedUd ? String(resolvedUd) : cleanHandle;

            let apiLiveSm = 0;
            let apiLiveHours = 0;
            let apiLiveMaxContMs = 0;
            const completedChallengeIds: number[] = [];

            if (liveMember) {
              if (liveMember.dl && typeof liveMember.dl.sm === 'number') {
                apiLiveSm = liveMember.dl.sm;
                apiLiveHours = liveMember.dl.sm / 3600000;
              }
              if (liveMember.dl && typeof liveMember.dl.mm === 'number') {
                apiLiveMaxContMs = liveMember.dl.mm;
              }
              if (liveMember.cls && typeof liveMember.cls === 'object') {
                for (const [cIdStr, cItem] of Object.entries(liveMember.cls)) {
                  if (cItem && (cItem as any).st === 1) completedChallengeIds.push(Number(cIdStr));
                }
              }
            }

            const prevStoredSm = challengeDailyHwms[resolvedUdKey] || (existingHwms[cleanHandle] ? Math.round(existingHwms[cleanHandle] * 3600000) : 0);
            const peakSm = Math.max(prevStoredSm, apiLiveSm, Math.round(apiLiveHours * 3600000));
            const peakHours = Math.round((peakSm / 3600000) * 100) / 100;
            existingHwms[cleanHandle] = peakHours;

            const prevMaxContStored = challengeDailyMaxContHwms[resolvedUdKey] || existingMaxContHwms[cleanHandle] || 0;
            const peakMaxContMs = Math.max(prevMaxContStored, apiLiveMaxContMs);
            existingMaxContHwms[cleanHandle] = peakMaxContMs;

            if (peakHours > 0) activeMemberCount++;
            dayTotalHours += peakHours;

            // Final lock applies penalties!
            const calculated = calculatePointsFromRulesNode(
              peakHours,
              challenge.rules,
              [],
              completedChallengeIds,
              true, // Apply penalty on final lock
              peakMaxContMs
            );

            dayTotalPoints += calculated.netPoints;

            const finalSnapshotItem = {
              handle: liveMember?.n || p.yptHandle || cleanHandle,
              nickname: liveMember?.n || p.yptHandle || cleanHandle,
              rawYptUd: resolvedUd,
              yptUd: resolvedUd,
              hoursStudied: peakHours,
              studyMs: peakSm,
              maxContinuousMs: peakMaxContMs,
              isCurrentlyStudying: false, // Day concluded
              completedNativeChallengeIds: completedChallengeIds,
              basePoints: calculated.baseStudyPoints,
              bonusPoints: calculated.bonusPoints,
              penaltyPoints: calculated.penaltyPoints,
              netPoints: calculated.netPoints,
              appliedRuleBreakdown: calculated.appliedRules,
              status: 'active',
              lastSyncedAt: new Date().toISOString(),
            };

            finalizedMemberSnapshots[cleanHandle] = finalSnapshotItem;
            if (resolvedUdKey && resolvedUdKey !== cleanHandle) {
              finalizedMemberSnapshots[resolvedUdKey] = finalSnapshotItem;
            }
          });

          // Build solo leaderboard participant standings sorted by dayPoints desc, then dayHours desc
          const seenKeys = new Set<string>();
          const participantDraft = Object.values(finalizedMemberSnapshots)
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
          participantDraft.sort((a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours);
          participantStandings = participantDraft.map((p, idx) => ({ ...p, rank: idx + 1 }));
        } else {
          // TEAM MODE: Finalize teams with penalties
          (challenge.teams || []).forEach((team: any) => {
            let teamDailyHours = 0;
            let teamDailyPoints = 0;

            (team.memberUids || []).forEach((memberHandleOrUid: string) => {
              const cleanHandle = memberHandleOrUid.replace(/^@/, '').trim().toLowerCase();
              const liveMember = liveMembers.find((m: any) =>
                (m.ud && String(m.ud) === memberHandleOrUid) ||
                areHandlesMatchingNode(m.n || m.nickname, cleanHandle, String(m.ud))
              );

              const resolvedUd = liveMember?.ud || (!isNaN(Number(memberHandleOrUid)) ? Number(memberHandleOrUid) : undefined);
              const resolvedUdKey = resolvedUd ? String(resolvedUd) : cleanHandle;

              let apiLiveSm = 0;
              let apiLiveHours = 0;
              let apiLiveMaxContMs = 0;
              const completedChallengeIds: number[] = [];

              if (liveMember) {
                if (liveMember.dl && typeof liveMember.dl.sm === 'number') {
                  apiLiveSm = liveMember.dl.sm;
                  apiLiveHours = liveMember.dl.sm / 3600000;
                }
                if (liveMember.dl && typeof liveMember.dl.mm === 'number') {
                  apiLiveMaxContMs = liveMember.dl.mm;
                }
                if (liveMember.cls && typeof liveMember.cls === 'object') {
                  for (const [cIdStr, cItem] of Object.entries(liveMember.cls)) {
                    if (cItem && (cItem as any).st === 1) completedChallengeIds.push(Number(cIdStr));
                  }
                }
              }

              const prevStoredSm = challengeDailyHwms[resolvedUdKey] || (existingHwms[cleanHandle] ? Math.round(existingHwms[cleanHandle] * 3600000) : 0);
              const peakSm = Math.max(prevStoredSm, apiLiveSm, Math.round(apiLiveHours * 3600000));
              const peakHours = Math.round((peakSm / 3600000) * 100) / 100;
              existingHwms[cleanHandle] = peakHours;

              const prevMaxContStored = challengeDailyMaxContHwms[resolvedUdKey] || existingMaxContHwms[cleanHandle] || 0;
              const peakMaxContMs = Math.max(prevMaxContStored, apiLiveMaxContMs);
              existingMaxContHwms[cleanHandle] = peakMaxContMs;

              if (peakHours > 0) activeMemberCount++;
              dayTotalHours += peakHours;
              teamDailyHours += peakHours;

              // Final lock applies penalties!
              const calculated = calculatePointsFromRulesNode(
                peakHours,
                challenge.rules,
                [],
                completedChallengeIds,
                true, // Apply penalty on final lock
                peakMaxContMs
              );

              teamDailyPoints += calculated.netPoints;

              finalizedMemberSnapshots[cleanHandle] = {
                handle: liveMember?.n || cleanHandle,
                rawYptUd: liveMember?.ud,
                hoursStudied: peakHours,
                studyMs: Math.round(peakHours * 3600000),
                maxContinuousMs: peakMaxContMs,
                isCurrentlyStudying: false, // Day concluded
                completedNativeChallengeIds: completedChallengeIds,
                basePoints: calculated.baseStudyPoints,
                bonusPoints: calculated.bonusPoints,
                penaltyPoints: calculated.penaltyPoints,
                netPoints: calculated.netPoints,
                appliedRuleBreakdown: calculated.appliedRules,
                status: 'active',
                lastSyncedAt: new Date().toISOString(),
              };
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

        teamStandingsDraft.sort((a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours);
        const teamStandings = teamStandingsDraft.map((t, idx) => ({ ...t, rank: idx + 1 }));

        const lockedYesterdayData: any = {
          id: yesterdayYmd,
          challengeId: challenge.id,
          dateYmd: yesterdayYmd,
          targetDateYmd: yesterdayYmd,
          isLocked: true,
          lockedAt: new Date().toISOString(),
          lockedBy: 'cron_system' as const,
          totalChallengeHours: Math.round(dayTotalHours * 100) / 100,
          totalChallengePoints: dayTotalPoints,
          activeMemberCount,
          memberSnapshots: finalizedMemberSnapshots,
          teamStandings: isSoloMode ? [] : teamStandings,
          participantStandings: isSoloMode ? participantStandings : undefined,
          highWaterMarks: existingHwms,
          maxContinuousHighWaterMarks: existingMaxContHwms,
          isAutoClosed: true,
          closedAt: Date.now(),
        };

        // Write locked snapshot for yesterday
        await yesterdaySnapRef.set(lockedYesterdayData, { merge: true });
        try {
          await adminDb.collection("yptChallenges").doc(challenge.id).collection("daily_snapshots").doc(`daily_${yesterdayYmd}`).set(lockedYesterdayData, { merge: true });
        } catch {}

        // STEP B: Check if Challenge has reached its End Date
        const challengeEndDateYmd = getChallengeEndDateYmdNode(challenge);
        const isChallengeConcluded = yesterdayYmd >= challengeEndDateYmd;

        if (isChallengeConcluded) {
          // Finalize and mark challenge as completed in Firestore
          const completionUpdate: any = {
            status: 'completed',
            completedAt: new Date().toISOString(),
            completedBy: 'cron_system',
            autoCompletedReason: `Reached end date ${challengeEndDateYmd} and finalized last day ${yesterdayYmd}.`,
          };

          // Fetch all daily snapshots to calculate overall tournament winner
          const allSnaps = await adminDb
            .collection("yptChallenges")
            .doc(challenge.id)
            .collection("dailySnapshots")
            .get();

          if (isSoloMode) {
            const memberPointTotals: Record<string, { yptUd?: number; yptHandle: string; points: number; hours: number }> = {};
            allSnaps.docs.forEach((docSnap) => {
              const data = docSnap.data() as any;
              if (data.participantStandings && Array.isArray(data.participantStandings)) {
                data.participantStandings.forEach((ps: any) => {
                  const key = (ps.yptHandle || '').replace(/^@/, '').trim().toLowerCase() || String(ps.yptUd || '');
                  if (!key) return;
                  if (!memberPointTotals[key]) {
                    memberPointTotals[key] = { yptUd: ps.yptUd, yptHandle: ps.yptHandle || key, points: 0, hours: 0 };
                  }
                  memberPointTotals[key].points += ps.dayPoints || 0;
                  memberPointTotals[key].hours += ps.dayHours || 0;
                });
              } else if (data.memberSnapshots) {
                Object.values(data.memberSnapshots).forEach((ms: any) => {
                  const key = (ms.handle || '').replace(/^@/, '').trim().toLowerCase() || String(ms.rawYptUd || '');
                  if (!key) return;
                  if (!memberPointTotals[key]) {
                    memberPointTotals[key] = { yptUd: ms.rawYptUd, yptHandle: ms.handle || key, points: 0, hours: 0 };
                  }
                  memberPointTotals[key].points += ms.netPoints || 0;
                  memberPointTotals[key].hours += ms.hoursStudied || 0;
                });
              }
            });

            const sortedParticipants = Object.values(memberPointTotals).sort((a, b) => b.points - a.points || b.hours - a.hours);
            const topWinner = sortedParticipants[0] || participantStandings[0];
            const sortedByHours = Object.values(memberPointTotals).sort((a, b) => b.hours - a.hours);
            const topMvp = sortedByHours[0];

            completionUpdate.winningParticipantUd = topWinner?.yptUd || null;
            completionUpdate.winningParticipantHandle = topWinner?.yptHandle || null;
            completionUpdate.finalMvpHandle = topMvp?.yptHandle || topWinner?.yptHandle || null;
          } else {
            const teamPointTotals: Record<string, { teamId: string; teamName: string; points: number; hours: number }> = {};
            (challenge.teams || []).forEach((t: any) => {
              teamPointTotals[t.id] = { teamId: t.id, teamName: t.name, points: t.totalPoints || 0, hours: 0 };
            });

            const memberHoursMap: Record<string, number> = {};
            allSnaps.docs.forEach((docSnap) => {
              const data = docSnap.data() as any;
              if (data.teamStandings && Array.isArray(data.teamStandings)) {
                data.teamStandings.forEach((ts: any) => {
                  if (ts.teamId && teamPointTotals[ts.teamId]) {
                    teamPointTotals[ts.teamId].hours += ts.dayHours || 0;
                  }
                });
              }
              if (data.memberSnapshots) {
                Object.values(data.memberSnapshots).forEach((ms: any) => {
                  const clean = (ms.handle || '').replace(/^@/, '').trim().toLowerCase();
                  memberHoursMap[clean] = (memberHoursMap[clean] || 0) + (ms.hoursStudied || 0);
                });
              }
            });

            const sortedTeams = Object.values(teamPointTotals).sort((a, b) => b.points - a.points || b.hours - a.hours);
            const topTeam = sortedTeams[0] || teamStandings[0];
            const sortedMembers = Object.entries(memberHoursMap).sort((a, b) => b[1] - a[1]);
            const topMvp = sortedMembers[0];

            completionUpdate.winningTeamId = topTeam?.teamId || null;
            completionUpdate.finalMvpHandle = topMvp ? topMvp[0] : null;
          }

          await adminDb.collection("yptChallenges").doc(challenge.id).update(completionUpdate);
          console.log(`[YPT 5:15 AM IST FINALIZER] Challenge ${challenge.id} reached end date (${challengeEndDateYmd}) and has been auto-completed with winners resolved.`);
        } else {
          // STEP C: Create Fresh Open Snapshot for Today (dateYmd = todayYmd) ONLY IF CHALLENGE IS STILL ACTIVE
          const todaySnapRef = adminDb.collection("yptChallenges").doc(challenge.id).collection("dailySnapshots").doc(todayYmd);
          const todaySnap = await todaySnapRef.get();

          if (!todaySnap.exists) {
            const initialMemberSnapshots: Record<string, any> = {};
            const initialTeamStandings: Array<{ teamId: string; teamName: string; dayHours: number; dayPoints: number; rank: number }> = [];
            let initialParticipantStandings: Array<{ yptUd?: number; yptHandle: string; dayHours: number; dayPoints: number; rank: number }> = [];

            if (isSoloMode) {
              const participantsList: Array<{ yptUd?: number; yptHandle: string }> =
                challenge.participants && challenge.participants.length > 0
                  ? challenge.participants
                  : liveMembers.map((m: any) => ({ yptUd: m.ud, yptHandle: m.n }));

              initialParticipantStandings = participantsList.map((p, idx) => {
                const cleanHandle = (p.yptHandle || '').replace(/^@/, '').trim().toLowerCase();
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
                  status: 'active',
                  lastSyncedAt: new Date().toISOString(),
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
                  const cleanHandle = mHandle.replace(/^@/, '').trim().toLowerCase();
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
                    status: 'active',
                    lastSyncedAt: new Date().toISOString(),
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

            const freshDayData: any = {
              id: todayYmd,
              challengeId: challenge.id,
              dateYmd: todayYmd,
              targetDateYmd: todayYmd,
              isLocked: false,
              totalChallengeHours: 0,
              totalChallengePoints: 0,
              activeMemberCount: 0,
              memberSnapshots: initialMemberSnapshots,
              teamStandings: isSoloMode ? [] : initialTeamStandings,
              participantStandings: isSoloMode ? initialParticipantStandings : undefined,
              highWaterMarks: {},
              maxContinuousHighWaterMarks: {},
              lastSyncedAt: new Date().toISOString(),
            };

            await todaySnapRef.set(freshDayData);
            try {
              await adminDb.collection("yptChallenges").doc(challenge.id).collection("daily_snapshots").doc(`daily_${todayYmd}`).set(freshDayData);
            } catch {}

            // Reset the main challenge document's daily high-water marks for the brand new day
            await adminDb.collection("yptChallenges").doc(challenge.id).update({
              dailyHighWaterMarks: {},
              dailyMaxContinuousHighWaterMarks: {},
              lastDailySnapshotDate: todayYmd,
              lastSyncedAt: new Date().toISOString(),
            });
          }

          console.log(`[YPT 5:15 AM IST FINALIZER] Successfully finalized ${yesterdayYmd} and created open snapshot for ${todayYmd} in ${challenge.id}.`);
        }
      } catch (chErr) {
        console.error(`[YPT 5:15 AM IST FINALIZER] Error processing challenge ${challenge.id}:`, chErr);
      }
    }
  } catch (err: any) {
    if (err && err.code === 7) {
      // Sandbox environment notice
    } else {
      console.error("[YPT 5:15 AM IST FINALIZER] Encountered unexpected error:", err);
    }
  }
}

export function startCron() {
  if (!db) {
    console.warn("Cron not started: Admin DB is not initialized. Might be missing ADC credentials.");
    return;
  }
  
  console.log("Registered 2-hour leaderboard recalculation cron job.");

  // Runs every 2 hours
  cron.schedule("0 */2 * * *", async () => {
    console.log("Running 2-hour leaderboard recalculation task...");
    try {
      // 1. Fetch all users
      const usersSnap = await db.collection("users").get();
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // 2. Fetch all mocks (using collectionGroup if possible, or individual queries)
      const mocksSnap = await db.collectionGroup("mocks").get();
      const allMocks = mocksSnap.docs.map(d => {
           const data = d.data();
           return { id: d.id, userId: d.ref.parent.parent?.id, ...data };
      }).filter((m: any) => !m.isDeleted);

      // Group mocks by user
      const userMocks: Record<string, any[]> = {};
      allMocks.forEach(m => {
          if (m.userId) {
              if (!userMocks[m.userId]) Object.assign(userMocks, { [m.userId]: [] });
              userMocks[m.userId].push(m);
          }
      });

      const batch = db.batch();
      let updatesCount = 0;

      for (const user of users) {
          const mocks = userMocks[user.id] || [];
          if (mocks.length === 0) continue;

          const { avgPercentile, totalTests } = calculateUserStats(mocks);

          if (user.avgPercentile !== avgPercentile || user.totalTests !== totalTests) {
              const ref = db.collection("users").doc(user.id);
              batch.update(ref, { 
                  avgPercentile, 
                  totalTests, 
              });
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

      console.log(`Leaderboard recalculation finished. Updated ${updatesCount} users.`);
    } catch (error: any) {
      if (error && error.code === 7) {
        console.warn("\n[WARNING] Leaderboard Cron skipped due to PERMISSION_DENIED.");
      } else {
        console.error("Leaderboard Cron failed:", error);
      }
    }
  });

  console.log("Registered nightly search API log auto-delete cron job.");
  // Runs every day at midnight (00:00)
  cron.schedule("0 0 * * *", async () => {
    console.log("Running nightly search API log auto-delete task...");
    try {
      const settingsDoc = await db.collection("system").doc("settings").get();
      const settings = settingsDoc.data();
      
      const searchLogAutoDeleteDays = settings?.searchLogAutoDeleteDays;
      
      if (typeof searchLogAutoDeleteDays === "number" && searchLogAutoDeleteDays > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - searchLogAutoDeleteDays);
        
        const oldLogsSnap = await db
          .collection("search_api_logs")
          .where("createdAt", "<", admin.firestore.Timestamp.fromDate(cutoffDate))
          .get();
          
        if (!oldLogsSnap.empty) {
          console.log(`Found ${oldLogsSnap.size} search API logs to delete.`);
          
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
          
          console.log(`Successfully deleted ${totalDeleted} search API logs.`);
        } else {
          console.log("No search API logs found for deletion.");
        }
      } else {
        console.log("searchLogAutoDeleteDays is not set or invalid. Skipping auto-delete.");
      }
    } catch (error: any) {
      if (error && error.code === 7) {
        console.warn("\n[WARNING] Auto-Delete Cron skipped due to PERMISSION_DENIED in sandbox environment.\n");
      } else {
        console.error("Search API Log Auto-Delete Cron failed:", error);
      }
    }
  });

  // Dynamic YPT Continuous Sync Cron Job Setup
  if (db) {
    initDynamicYptSync(db);
  }

  console.log("Registered 04:55 AM IST (23:25 UTC) YPT Pre-Reset Peak Capture cron job.");
  // Runs daily at 23:25 UTC (04:55 AM IST): captures absolute peak study hours before YPT 05:00 AM IST reset
  cron.schedule("25 23 * * *", async () => {
    if (db) {
      console.log("[YPT 4:55 AM IST PRE-RESET] Executing final pre-reset peak capture...");
      await execute15MinYptSync(db);
    }
  });

  console.log("Registered 05:15 AM IST (23:45 UTC) YPT Daily Finalizer & Day Transition cron job.");
  // Runs daily at 23:45 UTC (05:15 AM IST): locks yesterday's snapshot and opens fresh today snapshot
  cron.schedule("45 23 * * *", async () => {
    if (db) {
      await execute515AmYptFinalizer(db);
    }
  });
}

// Module-level dynamic task reference for YPT Continuous Sync
let dynamicYptSyncTask: ReturnType<typeof cron.schedule> | null = null;
let currentYptSyncIntervalMinutes = 15;
let lastYptSyncExecutionTime: string | null = null;
let isYptSyncRunning = false;

export function getCronExpressionForMinutes(minutes: number): string {
  const m = Math.max(1, Math.min(1440, Math.round(minutes)));
  if (m === 1) return "* * * * *";
  if (m < 60) {
    return `*/${m} * * * *`;
  }
  if (m === 60) return "0 * * * *";
  const hours = Math.floor(m / 60);
  if (hours < 24) {
    return `0 */${hours} * * *`;
  }
  return "0 0 * * *";
}

export function getYptSyncCronStatus() {
  return {
    intervalMinutes: currentYptSyncIntervalMinutes,
    cronExpression: getCronExpressionForMinutes(currentYptSyncIntervalMinutes),
    isRunning: isYptSyncRunning,
    lastSyncedAt: lastYptSyncExecutionTime,
    isScheduled: dynamicYptSyncTask !== null,
  };
}

export function updateYptSyncCronSchedule(adminDb: admin.firestore.Firestore, minutes: number) {
  const safeMinutes = Math.max(1, Math.min(1440, Number(minutes) || 15));
  if (dynamicYptSyncTask && currentYptSyncIntervalMinutes === safeMinutes) {
    return;
  }

  if (dynamicYptSyncTask) {
    try {
      dynamicYptSyncTask.stop();
      dynamicYptSyncTask = null;
    } catch (e) {
      console.warn("Failed to stop previous YPT sync task:", e);
    }
  }

  currentYptSyncIntervalMinutes = safeMinutes;
  const cronExp = getCronExpressionForMinutes(safeMinutes);
  console.log(`[YPT CRON SCHEDULER] Rescheduled continuous sync every ${safeMinutes} min(s) using expression: "${cronExp}"`);

  dynamicYptSyncTask = cron.schedule(cronExp, async () => {
    if (adminDb) {
      isYptSyncRunning = true;
      try {
        await execute15MinYptSync(adminDb);
        lastYptSyncExecutionTime = new Date().toISOString();
      } finally {
        isYptSyncRunning = false;
      }
    }
  });
}

async function initDynamicYptSync(adminDb: admin.firestore.Firestore) {
  try {
    const settingsDoc = await adminDb.collection("system").doc("settings").get();
    let initialMinutes = 15;
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      if (data?.yptSyncIntervalMinutes && !isNaN(Number(data.yptSyncIntervalMinutes))) {
        initialMinutes = Number(data.yptSyncIntervalMinutes);
      }
    }
    updateYptSyncCronSchedule(adminDb, initialMinutes);

    // Set up real-time listener so changes from UI are reflected instantly without server restart
    adminDb.collection("system").doc("settings").onSnapshot((snap) => {
      if (snap.exists) {
        const val = snap.data()?.yptSyncIntervalMinutes;
        if (val && !isNaN(Number(val))) {
          updateYptSyncCronSchedule(adminDb, Number(val));
        }
      }
    }, (err) => {
      console.warn("[YPT CRON] Realtime settings listener note:", err.message);
    });
  } catch (err: any) {
    console.warn("[YPT CRON] Initialization notice, falling back to 15m default:", err?.message || err);
    updateYptSyncCronSchedule(adminDb, 15);
  }
}

export { 
  execute15MinYptSync as executeContinuousYptSync,
  execute15MinYptSync,
  execute515AmYptFinalizer 
};

