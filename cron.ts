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
 * ============================================================================
 * FIRESTORE REST API ENCODING / DECODING & AUTONOMOUS FALLBACK ENGINE
 * Enables the 5:15 AM finalizer and continuous cron to execute seamlessly
 * even when Cloud Run fails to mount the default Firebase Admin Service Account (Error 7).
 * ============================================================================
 */

function encodeFirestoreRestValue(val: any): any {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(encodeFirestoreRestValue),
      },
    };
  }
  if (typeof val === 'object') {
    if (val._methodName === 'serverTimestamp' || val.constructor?.name === 'FieldValue') {
      return { timestampValue: new Date().toISOString() };
    }
    if (typeof val.toDate === 'function') {
      return { timestampValue: val.toDate().toISOString() };
    }
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = encodeFirestoreRestValue(v);
      }
    }
    return {
      mapValue: {
        fields,
      },
    };
  }
  return { stringValue: String(val) };
}

function encodeFirestoreRestFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = encodeFirestoreRestValue(v);
    }
  }
  return fields;
}

function parseFirestoreRestFields(fields: any): any {
  if (!fields || typeof fields !== 'object') return null;
  const result: any = {};
  for (const [key, value] of Object.entries(fields) as [string, any][]) {
    if (!value || typeof value !== 'object') continue;
    if ('stringValue' in value) result[key] = value.stringValue;
    else if ('booleanValue' in value) result[key] = value.booleanValue;
    else if ('integerValue' in value) result[key] = parseInt(value.integerValue, 10);
    else if ('doubleValue' in value) result[key] = parseFloat(value.doubleValue);
    else if ('timestampValue' in value) result[key] = value.timestampValue;
    else if ('mapValue' in value) result[key] = parseFirestoreRestFields(value.mapValue?.fields);
    else if ('arrayValue' in value) {
      result[key] = (value.arrayValue?.values || []).map((item: any) =>
        parseFirestoreRestFields({ temp: item })?.temp
      );
    } else if ('nullValue' in value) result[key] = null;
  }
  return result;
}

function getFirestoreRestConfig(): { baseUrl: string; apiKey: string; projectId: string; dbId: string } {
  const fbConfig = getFirebaseConfig();
  const projectId = fbConfig.projectId || "project-8cd430e4-1498-4f8c-b8f";
  const dbId = fbConfig.firestoreDatabaseId || "(default)";
  const apiKey = fbConfig.apiKey || process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "AIzaSyD_6GOGVqF_DJqhalF0gocMOjckhhWoWRI";
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents`;
  return { baseUrl, apiKey, projectId, dbId };
}

async function fetchFirestoreRestDoc(docPath: string): Promise<any | null> {
  const { baseUrl, apiKey } = getFirestoreRestConfig();
  const cleanPath = docPath.replace(/^\//, '');
  const url = `${baseUrl}/${cleanPath}${apiKey ? `?key=${apiKey}` : ''}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return null;
      return null;
    }
    const data: any = await res.json();
    return data?.fields ? parseFirestoreRestFields(data.fields) : null;
  } catch (err) {
    console.warn(`[Firestore REST] Error reading doc ${docPath}:`, err);
    return null;
  }
}

async function fetchFirestoreRestCollection(collectionPath: string): Promise<Array<{ id: string; data: any }>> {
  const { baseUrl, apiKey } = getFirestoreRestConfig();
  const cleanPath = collectionPath.replace(/^\//, '');
  const url = `${baseUrl}/${cleanPath}?pageSize=300${apiKey ? `&key=${apiKey}` : ''}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return [];
      return [];
    }
    const data: any = await res.json();
    const docs: Array<{ id: string; data: any }> = [];
    if (Array.isArray(data.documents)) {
      for (const doc of data.documents) {
        const docName = doc.name || '';
        const docId = docName.split('/').pop() || '';
        docs.push({
          id: docId,
          data: doc.fields ? parseFirestoreRestFields(doc.fields) : {},
        });
      }
    }
    return docs;
  } catch (err) {
    console.warn(`[Firestore REST] Error listing collection ${collectionPath}:`, err);
    return [];
  }
}

async function setFirestoreRestDoc(docPath: string, data: any, merge: boolean = true): Promise<any> {
  const { apiKey, projectId, dbId } = getFirestoreRestConfig();
  const cleanPath = docPath.replace(/^\//, '');
  const docFullName = `projects/${projectId}/databases/${dbId}/documents/${cleanPath}`;
  const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents:commit${apiKey ? `?key=${apiKey}` : ''}`;

  const fields = encodeFirestoreRestFields(data);
  const writePayload: any = {
    update: {
      name: docFullName,
      fields,
    },
  };

  if (merge) {
    writePayload.updateMask = {
      fieldPaths: Object.keys(data),
    };
  }

  try {
    const res = await fetch(commitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [writePayload],
      }),
    });

    if (!res.ok) {
      // Direct PATCH fallback
      const fieldMaskParams = merge
        ? Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
        : '';
      const patchUrl = `https://firestore.googleapis.com/v1/${docFullName}?${fieldMaskParams ? `${fieldMaskParams}&` : ''}${apiKey ? `key=${apiKey}` : ''}`;
      const patchRes = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      if (!patchRes.ok) {
        const txt = await patchRes.text();
        throw new Error(`Firestore REST write failed: ${patchRes.status} ${txt}`);
      }
      return await patchRes.json();
    }

    return await res.json();
  } catch (err) {
    console.error(`[Firestore REST] Failed writing doc ${docPath}:`, err);
    throw err;
  }
}

async function updateFirestoreRestDoc(docPath: string, data: any): Promise<any> {
  return setFirestoreRestDoc(docPath, data, true);
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

  if (Array.isArray(rules.customRules)) {
    for (const cr of rules.customRules) {
      let isMet = false;
      const targetHours = Number(cr.targetHours || cr.hours) || 0;
      const targetMins = Number(cr.targetMinutes || cr.minutes) || 0;
      const effectiveTargetHours = targetHours + (targetMins / 60);

      const hasNativeId = Boolean(cr.nativeChallengeId || cr.challengeId);
      const targetCid = Number(cr.nativeChallengeId || cr.challengeId);
      
      const isNativeChallengeCompleted = Boolean(
        hasNativeId &&
        !isNaN(targetCid) &&
        (completedNativeChallengeIds.includes(targetCid) ||
         completedNativeChallengeIds.map(String).includes(String(targetCid)))
      );

      const ruleEmoji = cr.emoji ? String(cr.emoji).trim() : '';
      const nameLower = (cr.name || '').toLowerCase();

      // If linked to a native challenge ID, strictly evaluate that challenge ID completion!
      const missionMatched = hasNativeId
        ? isNativeChallengeCompleted
        : (
            Boolean(ruleEmoji && detectedEmojis.some((e) => e.includes(ruleEmoji) || ruleEmoji.includes(e))) ||
            Boolean(nameLower.includes('snap') && detectedEmojis.includes('☀️'))
          );

      const minHours = cr.minHoursNeeded ?? 0;
      const hoursMatched = hoursStudied >= minHours;
      const condition = cr.conditionType || 'emoji_only';

      if (cr.type === 'milestone' || cr.criteriaType === 'study_hours' || cr.category === 'study_hours') {
        isMet = effectiveTargetHours > 0 && hoursStudied >= effectiveTargetHours;
      } else if (cr.criteriaType === 'native_challenge' || cr.category === 'native_challenge') {
        isMet = isNativeChallengeCompleted;
      } else {
        if (condition === 'emoji_only') {
          isMet = missionMatched;
        } else if (condition === 'hours_only') {
          isMet = hoursMatched;
        } else if (condition === 'both') {
          isMet = missionMatched && hoursMatched;
        } else if (condition === 'either') {
          isMet = missionMatched || hoursMatched;
        } else {
          isMet = missionMatched;
        }
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
          .concat(challenge.groupIds || [])
          .concat(challenge.targetGroupIds || []);

        const rawGroupId = challenge.yptGroupId || (challenge.groups?.[0]?.id || challenge.groups?.[0]?.gid) || (challenge.groupIds?.[0]) || (challenge.targetGroupIds?.[0]) || (groupIds.length > 0 ? groupIds[0] : null);
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
        let challengeDailyCompletedChallenges: Record<string, number[]> = {};

        const challengeDocRef = adminDb.collection("yptChallenges").doc(challenge.id);
        const freshChallengeDoc = await challengeDocRef.get();
        if (freshChallengeDoc.exists) {
          const chData = freshChallengeDoc.data() as any;
          // DATE-AWARE MEMORY BANK GUARD:
          // If the challenge document's lastDailySnapshotDate is older than activeYmd (e.g. yesterday, during 5:00-5:15 AM window),
          // do NOT load yesterday's dailyHighWaterMarks/completedChallenges into today's fresh memory bank.
          const isStaleCrossBoundaryData = chData?.lastDailySnapshotDate && chData.lastDailySnapshotDate < activeYmd;

          if (!isStaleCrossBoundaryData) {
            if (chData?.dailyHighWaterMarks && typeof chData.dailyHighWaterMarks === 'object') {
              challengeDailyHwms = { ...chData.dailyHighWaterMarks };
            }
            if (chData?.dailyMaxContinuousHighWaterMarks && typeof chData.dailyMaxContinuousHighWaterMarks === 'object') {
              challengeDailyMaxContHwms = { ...chData.dailyMaxContinuousHighWaterMarks };
            }
            if (chData?.dailyCompletedChallenges && typeof chData.dailyCompletedChallenges === 'object') {
              challengeDailyCompletedChallenges = { ...chData.dailyCompletedChallenges };
            }
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
              if (Array.isArray((m as any).completedNativeChallengeIds) && (m as any).completedNativeChallengeIds.length > 0) {
                const prev = challengeDailyCompletedChallenges[h] || [];
                challengeDailyCompletedChallenges[h] = Array.from(new Set([...prev, ...(m as any).completedNativeChallengeIds]));
              }
            }
          }
        }

        const mode = challenge.mode || 'team';
        const isSoloMode = mode === 'individual';

        const updatedHwms: Record<string, number> = { ...existingHwms };
        const updatedMaxContHwms: Record<string, number> = { ...existingMaxContHwms };
        const updatedChallengeHwms: Record<string, number> = { ...challengeDailyHwms };
        const updatedChallengeMaxContHwms: Record<string, number> = { ...challengeDailyMaxContHwms };
        const updatedChallengeCompletedChallenges: Record<string, number[]> = { ...challengeDailyCompletedChallenges };
        const memberSnapshots: Record<string, any> = {};
        const memberRecords: any[] = [];
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
              // Extract both dictionary key (Challenge ID) and entry item ID (Submission ID)
              if (liveMember.cls && typeof liveMember.cls === 'object') {
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

            // Merge newly completed challenge IDs with whatever was already stored in dailyCompletedChallenges
            const prevStoredCompleted = challengeDailyCompletedChallenges[resolvedUdKey] || challengeDailyCompletedChallenges[cleanHandle] || [];
            const mergedCompletedSet = new Set<number>([
              ...prevStoredCompleted,
              ...completedChallengeIds,
            ]);
            const finalCompletedList = Array.from(mergedCompletedSet);
            updatedChallengeCompletedChallenges[resolvedUdKey] = finalCompletedList;
            if (cleanHandle && cleanHandle !== resolvedUdKey) {
              updatedChallengeCompletedChallenges[cleanHandle] = finalCompletedList;
            }

            if (challenge.nativeYptChallengeId && finalCompletedList.includes(Number(challenge.nativeYptChallengeId))) {
              hasCompletedActiveChallenge = true;
            } else if (!challenge.nativeYptChallengeId && finalCompletedList.length > 0) {
              hasCompletedActiveChallenge = true;
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
              finalCompletedList,
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
              completedChallengeIds: finalCompletedList,
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
              completedNativeChallengeIds: finalCompletedList,
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

            memberRecords.push({
              yptHandle: liveMember?.n || p.yptHandle || cleanHandle,
              userId: resolvedUd ? String(resolvedUd) : undefined,
              hoursStudied: peakHours,
              basePoints: calculated.baseStudyPoints,
              bonusPoints: calculated.bonusPoints,
              penaltyPoints: 0,
              netPoints: calculated.netPoints,
              isCurrentlyStudying,
              appliedRules: calculated.appliedRules,
              completedChallengeIds: finalCompletedList,
            });
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

              // Merge newly completed challenge IDs with whatever was already stored in dailyCompletedChallenges
              const prevStoredCompleted = challengeDailyCompletedChallenges[resolvedUdKey] || challengeDailyCompletedChallenges[cleanHandle] || [];
              const mergedCompletedSet = new Set<number>([
                ...prevStoredCompleted,
                ...completedChallengeIds,
              ]);
              const finalCompletedList = Array.from(mergedCompletedSet);
              updatedChallengeCompletedChallenges[resolvedUdKey] = finalCompletedList;
              if (cleanHandle && cleanHandle !== resolvedUdKey) {
                updatedChallengeCompletedChallenges[cleanHandle] = finalCompletedList;
              }

              if (challenge.nativeYptChallengeId && finalCompletedList.includes(Number(challenge.nativeYptChallengeId))) {
                hasCompletedActiveChallenge = true;
              } else if (!challenge.nativeYptChallengeId && finalCompletedList.length > 0) {
                hasCompletedActiveChallenge = true;
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
                finalCompletedList,
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
                completedChallengeIds: finalCompletedList,
                lastSyncedAt: new Date().toISOString(),
              });

              memberSnapshots[cleanHandle] = {
                handle: liveMember?.n || cleanHandle,
                rawYptUd: resolvedUd,
                hoursStudied: peakHours,
                studyMs: peakSm,
                maxContinuousMs: peakMaxContMs,
                isCurrentlyStudying,
                completedNativeChallengeIds: finalCompletedList,
                hasCompleted: hasCompletedActiveChallenge,
                basePoints: calculated.baseStudyPoints,
                bonusPoints: calculated.bonusPoints,
                penaltyPoints: 0,
                netPoints: calculated.netPoints,
                appliedRuleBreakdown: calculated.appliedRules,
                status: 'active',
                lastSyncedAt: new Date().toISOString(),
              };

              memberRecords.push({
                yptHandle: liveMember?.n || cleanHandle,
                userId: resolvedUd ? String(resolvedUd) : undefined,
                hoursStudied: peakHours,
                basePoints: calculated.baseStudyPoints,
                bonusPoints: calculated.bonusPoints,
                penaltyPoints: 0,
                netPoints: calculated.netPoints,
                isCurrentlyStudying,
                appliedRules: calculated.appliedRules,
                completedChallengeIds: finalCompletedList,
              });
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
          memberRecords,
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
        // - dailyCompletedChallenges: The merged map of completed challenge IDs
        // - lastCronSyncAt: Firestore FieldValue.serverTimestamp()
        const challengeUpdatePayload: any = {
          dailyHighWaterMarks: updatedChallengeHwms,
          dailyMaxContinuousHighWaterMarks: updatedChallengeMaxContHwms,
          dailyCompletedChallenges: updatedChallengeCompletedChallenges,
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
      try {
        await writeBatch.commit();
        console.log(`[YPT 15-MIN CRON] Phase 4 Batch Commit: Successfully committed ${batchOperationCount} write operations across ${activeChallenges.length} active challenge(s) simultaneously.`);
      } catch (commitErr: any) {
        if (commitErr && (commitErr.code === 7 || commitErr.code === 16 || commitErr.message?.includes("PERMISSION_DENIED") || commitErr.message?.includes("ADC") || commitErr.message?.includes("UNAUTHENTICATED"))) {
          console.warn("[YPT 15-MIN CRON] Admin writeBatch.commit() encountered Error 7 (PERMISSION_DENIED). Synchronizing challenge states via authenticated Firestore REST API fallback...");
          return await executeContinuousYptSyncViaRest();
        } else {
          throw commitErr;
        }
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
    if (err && (err.code === 7 || err.code === 16 || err.message?.includes("PERMISSION_DENIED") || err.message?.includes("ADC") || err.message?.includes("UNAUTHENTICATED"))) {
      console.warn("[YPT 15-MIN CRON] Admin Firestore encountered PERMISSION_DENIED (Error 7). Delegating to authenticated Firestore REST API sync...");
      return await executeContinuousYptSyncViaRest();
    } else {
      console.error("[YPT 15-MIN CRON] Encountered unexpected error, attempting REST fallback:", err);
      try {
        return await executeContinuousYptSyncViaRest();
      } catch (restErr: any) {
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
}

/**
 * Executes 15-Minute Continuous Sync directly via authenticated Google Cloud Firestore REST API.
 * Uses apiKey from firebase-applet-config.json to authenticate even when Vercel or Cloud Run fails to mount
 * the default Firebase Admin Service Account (Error 7: PERMISSION_DENIED).
 */
async function executeContinuousYptSyncViaRest(): Promise<YptSyncDiagnosticReport> {
  const startTimeMs = Date.now();
  const results: YptSyncDiagnosticResult[] = [];
  const errors: string[] = [];
  const activeYmd = getYptDayYmdNode();
  console.log(`[YPT 15-MIN REST SYNC] Starting live sync for active date: ${activeYmd} via REST API fallback...`);

  try {
    const rawChallenges = await fetchFirestoreRestCollection("yptChallenges");
    const activeChallenges = rawChallenges
      .map((d) => ({ id: d.id, ...d.data } as any))
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

    for (const challenge of activeChallenges) {
      try {
        const challengeEndDateYmd = getChallengeEndDateYmdNode(challenge);
        if (activeYmd > challengeEndDateYmd) {
          continue;
        }

        const groupIds = (challenge.groups || []).map((g: any) => g.id || g.gid || g)
          .concat(challenge.yptGroupId ? [challenge.yptGroupId] : [])
          .concat(challenge.groupIds || [])
          .concat(challenge.targetGroupIds || []);

        const rawGroupId = challenge.yptGroupId || (challenge.groups?.[0]?.id || challenge.groups?.[0]?.gid) || (challenge.groupIds?.[0]) || (challenge.targetGroupIds?.[0]) || (groupIds.length > 0 ? groupIds[0] : null);
        const resolvedYptGroupId = rawGroupId ? (!isNaN(Number(rawGroupId)) ? Number(rawGroupId) : rawGroupId) : null;

        const { members: liveMembers, errors: rosterErrors } = await fetchYptRosterForChallengeNode(groupIds);
        if (rosterErrors && rosterErrors.length > 0) {
          errors.push(...rosterErrors);
        }

        let existingHwms: Record<string, number> = {};
        let existingMaxContHwms: Record<string, number> = {};
        let challengeDailyHwms: Record<string, number> = {};
        let challengeDailyMaxContHwms: Record<string, number> = {};
        let challengeDailyCompletedChallenges: Record<string, number[]> = {};

        const freshChallengeData = await fetchFirestoreRestDoc(`yptChallenges/${challenge.id}`);
        if (freshChallengeData) {
          // DATE-AWARE MEMORY BANK GUARD:
          // If the challenge document's lastDailySnapshotDate is older than activeYmd (e.g. yesterday, during 5:00-5:15 AM window),
          // do NOT load yesterday's dailyHighWaterMarks/completedChallenges into today's fresh memory bank.
          const isStaleCrossBoundaryData = freshChallengeData?.lastDailySnapshotDate && freshChallengeData.lastDailySnapshotDate < activeYmd;

          if (!isStaleCrossBoundaryData) {
            if (freshChallengeData.dailyHighWaterMarks && typeof freshChallengeData.dailyHighWaterMarks === 'object') {
              challengeDailyHwms = { ...freshChallengeData.dailyHighWaterMarks };
            }
            if (freshChallengeData.dailyMaxContinuousHighWaterMarks && typeof freshChallengeData.dailyMaxContinuousHighWaterMarks === 'object') {
              challengeDailyMaxContHwms = { ...freshChallengeData.dailyMaxContinuousHighWaterMarks };
            }
            if (freshChallengeData.dailyCompletedChallenges && typeof freshChallengeData.dailyCompletedChallenges === 'object') {
              challengeDailyCompletedChallenges = { ...freshChallengeData.dailyCompletedChallenges };
            }
          }
        }

        const existingSnapData = await fetchFirestoreRestDoc(`yptChallenges/${challenge.id}/dailySnapshots/${activeYmd}`);
        if (existingSnapData) {
          if (existingSnapData.isLocked) {
            continue;
          }
          if (existingSnapData.highWaterMarks) {
            existingHwms = { ...existingSnapData.highWaterMarks };
          }
          if (existingSnapData.maxContinuousHighWaterMarks) {
            existingMaxContHwms = { ...existingSnapData.maxContinuousHighWaterMarks };
          }
          if (existingSnapData.memberSnapshots) {
            for (const [h, m] of Object.entries(existingSnapData.memberSnapshots)) {
              existingHwms[h] = Math.max(existingHwms[h] || 0, (m as any).hoursStudied || 0);
              existingMaxContHwms[h] = Math.max(existingMaxContHwms[h] || 0, (m as any).maxContinuousMs || 0);
              if (Array.isArray((m as any).completedNativeChallengeIds) && (m as any).completedNativeChallengeIds.length > 0) {
                const prev = challengeDailyCompletedChallenges[h] || [];
                challengeDailyCompletedChallenges[h] = Array.from(new Set([...prev, ...(m as any).completedNativeChallengeIds]));
              }
            }
          }
        }

        const mode = challenge.mode || 'team';
        const isSoloMode = mode === 'individual';

        const updatedHwms: Record<string, number> = { ...existingHwms };
        const updatedMaxContHwms: Record<string, number> = { ...existingMaxContHwms };
        const updatedChallengeHwms: Record<string, number> = { ...challengeDailyHwms };
        const updatedChallengeMaxContHwms: Record<string, number> = { ...challengeDailyMaxContHwms };
        const updatedChallengeCompletedChallenges: Record<string, number[]> = { ...challengeDailyCompletedChallenges };
        const memberSnapshots: Record<string, any> = {};
        const memberRecords: any[] = [];
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
          const participantsList: Array<{ yptUd?: number; yptHandle: string }> =
            challenge.participants && challenge.participants.length > 0
              ? challenge.participants
              : liveMembers.map((m: any) => ({ yptUd: m.ud, yptHandle: m.n }));

          participantsList.forEach((p) => {
            const cleanHandle = (p.yptHandle || '').replace(/^@/, '').trim().toLowerCase();
            const memberUdStr = p.yptUd ? String(p.yptUd) : '';
            if (!cleanHandle && !memberUdStr) return;

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

              if (liveMember.cls && typeof liveMember.cls === 'object') {
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

            const prevStoredCompleted = challengeDailyCompletedChallenges[resolvedUdKey] || challengeDailyCompletedChallenges[cleanHandle] || [];
            const mergedCompletedSet = new Set<number>([
              ...prevStoredCompleted,
              ...completedChallengeIds,
            ]);
            const finalCompletedList = Array.from(mergedCompletedSet);
            updatedChallengeCompletedChallenges[resolvedUdKey] = finalCompletedList;
            if (cleanHandle && cleanHandle !== resolvedUdKey) {
              updatedChallengeCompletedChallenges[cleanHandle] = finalCompletedList;
            }

            if (challenge.nativeYptChallengeId && finalCompletedList.includes(Number(challenge.nativeYptChallengeId))) {
              hasCompletedActiveChallenge = true;
            } else if (!challenge.nativeYptChallengeId && finalCompletedList.length > 0) {
              hasCompletedActiveChallenge = true;
            }

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

            const calculated = calculatePointsFromRulesNode(
              peakHours,
              challenge.rules,
              [],
              finalCompletedList,
              false, // No penalties on live open day
              peakMaxContMs
            );

            dayTotalPoints += calculated.netPoints;

            const isCurrentlyStudying = Boolean(liveMember?.dl?.is);

            const snapItem = {
              handle: liveMember?.n || p.yptHandle || cleanHandle,
              nickname: liveMember?.n || p.yptHandle || cleanHandle,
              rawYptUd: resolvedUd,
              yptUd: resolvedUd,
              hoursStudied: peakHours,
              studyMs: peakSm,
              maxContinuousMs: peakMaxContMs,
              isCurrentlyStudying,
              isStudying: isCurrentlyStudying,
              completedNativeChallengeIds: finalCompletedList,
              hasCompleted: hasCompletedActiveChallenge,
              basePoints: calculated.baseStudyPoints,
              bonusPoints: calculated.bonusPoints,
              penaltyPoints: calculated.penaltyPoints,
              netPoints: calculated.netPoints,
              appliedRuleBreakdown: calculated.appliedRules,
              status: 'active',
              lastSyncedAt: new Date().toISOString(),
            };

            memberSnapshots[cleanHandle] = snapItem;
            if (resolvedUdKey && resolvedUdKey !== cleanHandle) {
              memberSnapshots[resolvedUdKey] = snapItem;
            }

            updatedParticipants.push({
              yptUd: resolvedUd,
              yptHandle: liveMember?.n || p.yptHandle || cleanHandle,
              hours: peakHours,
              studyMs: peakSm,
              isStudying: isCurrentlyStudying,
              hasCompleted: hasCompletedActiveChallenge,
              completedChallengeIds: finalCompletedList,
              lastSyncedAt: new Date().toISOString(),
            });

            memberRecords.push({
              yptHandle: liveMember?.n || p.yptHandle || cleanHandle,
              userId: resolvedUd ? String(resolvedUd) : undefined,
              hoursStudied: peakHours,
              basePoints: calculated.baseStudyPoints,
              bonusPoints: calculated.bonusPoints,
              penaltyPoints: calculated.penaltyPoints || 0,
              netPoints: calculated.netPoints,
              isCurrentlyStudying,
              appliedRules: calculated.appliedRules,
              completedChallengeIds: finalCompletedList,
            });
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
          participantDraft.sort((a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours);
          participantStandings = participantDraft.map((p, idx) => ({ ...p, rank: idx + 1 }));
        } else {
          (challenge.teams || []).forEach((team: any) => {
            let teamDailyHours = 0;
            let teamDailyPoints = 0;

            (team.memberUids || []).forEach((memberHandleOrUid: string) => {
              const cleanHandle = memberHandleOrUid.replace(/^@/, '').trim().toLowerCase();
              const liveMember = liveMembers.find((m: any) => {
                if (m.ud && String(m.ud) === memberHandleOrUid) return true;
                return areHandlesMatchingNode(m.n || m.nickname, cleanHandle, String(m.ud));
              });

              const resolvedUd = liveMember?.ud || (!isNaN(Number(memberHandleOrUid)) ? Number(memberHandleOrUid) : 0);
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

              const prevStoredCompleted = challengeDailyCompletedChallenges[resolvedUdKey] || challengeDailyCompletedChallenges[cleanHandle] || [];
              const mergedCompletedSet = new Set<number>([
                ...prevStoredCompleted,
                ...completedChallengeIds,
              ]);
              const finalCompletedList = Array.from(mergedCompletedSet);
              updatedChallengeCompletedChallenges[resolvedUdKey] = finalCompletedList;
              if (cleanHandle && cleanHandle !== resolvedUdKey) {
                updatedChallengeCompletedChallenges[cleanHandle] = finalCompletedList;
              }

              if (challenge.nativeYptChallengeId && finalCompletedList.includes(Number(challenge.nativeYptChallengeId))) {
                hasCompletedActiveChallenge = true;
              } else if (!challenge.nativeYptChallengeId && finalCompletedList.length > 0) {
                hasCompletedActiveChallenge = true;
              }

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

              const calculated = calculatePointsFromRulesNode(
                peakHours,
                challenge.rules,
                [],
                finalCompletedList,
                false, // No penalties on live open day
                peakMaxContMs
              );

              teamDailyPoints += calculated.netPoints;

              const isCurrentlyStudying = Boolean(liveMember?.dl?.is);

              memberSnapshots[cleanHandle] = {
                handle: liveMember?.n || cleanHandle,
                rawYptUd: liveMember?.ud,
                hoursStudied: peakHours,
                studyMs: peakSm,
                maxContinuousMs: peakMaxContMs,
                isCurrentlyStudying,
                isStudying: isCurrentlyStudying,
                completedNativeChallengeIds: finalCompletedList,
                hasCompleted: hasCompletedActiveChallenge,
                basePoints: calculated.baseStudyPoints,
                bonusPoints: calculated.bonusPoints,
                penaltyPoints: calculated.penaltyPoints,
                netPoints: calculated.netPoints,
                appliedRuleBreakdown: calculated.appliedRules,
                status: 'active',
                lastSyncedAt: new Date().toISOString(),
              };

              updatedParticipants.push({
                yptUd: resolvedUd,
                yptHandle: liveMember?.n || cleanHandle,
                hours: peakHours,
                studyMs: peakSm,
                isStudying: isCurrentlyStudying,
                hasCompleted: hasCompletedActiveChallenge,
                completedChallengeIds: finalCompletedList,
                lastSyncedAt: new Date().toISOString(),
              });

              memberRecords.push({
                yptHandle: liveMember?.n || cleanHandle,
                userId: resolvedUd ? String(resolvedUd) : undefined,
                hoursStudied: peakHours,
                basePoints: calculated.baseStudyPoints,
                bonusPoints: calculated.bonusPoints,
                penaltyPoints: calculated.penaltyPoints || 0,
                netPoints: calculated.netPoints,
                isCurrentlyStudying,
                appliedRules: calculated.appliedRules,
                completedChallengeIds: finalCompletedList,
              });
            });

            teamStandingsDraft.push({
              teamId: team.id,
              teamName: team.name || `Team ${team.id}`,
              dayHours: Math.round(teamDailyHours * 100) / 100,
              dayPoints: teamDailyPoints,
            });

            dayTotalPoints += teamDailyPoints;
          });

          teamStandingsDraft.sort((a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours);
        }

        const teamStandings = teamStandingsDraft.map((t, idx) => ({ ...t, rank: idx + 1 }));

        const snapshotData: any = {
          id: activeYmd,
          challengeId: challenge.id,
          dateYmd: activeYmd,
          targetDateYmd: activeYmd,
          isLocked: false,
          totalChallengeHours: Math.round(dayTotalHours * 100) / 100,
          totalHoursStudied: Math.round(dayTotalHours * 100) / 100,
          totalChallengePoints: dayTotalPoints,
          activeMemberCount,
          memberSnapshots,
          memberRecords,
          teamStandings: isSoloMode ? [] : teamStandings,
          participantStandings: isSoloMode ? participantStandings : undefined,
          highWaterMarks: updatedHwms,
          maxContinuousHighWaterMarks: updatedMaxContHwms,
          lastSyncedAt: new Date().toISOString(),
        };

        // Write daily snapshot via REST (canonical path)
        await setFirestoreRestDoc(`yptChallenges/${challenge.id}/dailySnapshots/${activeYmd}`, snapshotData);
        // Also write legacy path for backward compatibility
        try {
          await setFirestoreRestDoc(`yptChallenges/${challenge.id}/daily_snapshots/daily_${activeYmd}`, snapshotData);
        } catch {}

        // Update challenge doc via REST
        const challengeUpdatePayload: any = {
          dailyHighWaterMarks: updatedChallengeHwms,
          dailyMaxContinuousHighWaterMarks: updatedChallengeMaxContHwms,
          dailyCompletedChallenges: updatedChallengeCompletedChallenges,
          lastDailySnapshotDate: activeYmd,
          lastSyncedAt: new Date().toISOString(),
          lastCronSyncAt: new Date().toISOString(),
        };
        if (updatedParticipants.length > 0) {
          challengeUpdatePayload.participants = updatedParticipants;
        }
        await updateFirestoreRestDoc(`yptChallenges/${challenge.id}`, challengeUpdatePayload);

        results.push({
          challengeId: challenge.id,
          challengeName: challenge.title || challenge.name || "Untitled Challenge",
          yptGroupId: resolvedYptGroupId,
          participantsFound: liveMembers.length,
          participantsUpdated: updatedParticipants.length,
        });

        console.log(`[YPT 15-MIN REST SYNC] Successfully synced challenge ${challenge.title || challenge.name || challenge.id} (${activeYmd}) via REST.`);
      } catch (chErr: any) {
        const errDesc = `Error in REST sync for challenge ${challenge.id}: ${chErr?.message || String(chErr)}`;
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
 * Executes 5:15 AM IST Daily Finalizer directly via authenticated Google Cloud Firestore REST API.
 * Uses apiKey from firebase-applet-config.json to authenticate even when Cloud Run fails to mount
 * the default Firebase Admin Service Account (Error 7: PERMISSION_DENIED).
 */
async function execute515AmYptFinalizerViaRest(): Promise<void> {
  const yesterdayYmd = getYesterdayYptDayYmdNode();
  const todayYmd = getYptDayYmdNode();
  console.log(`[YPT 5:15 AM REST FINALIZER] Executing Day Transition via REST API fallback. Concluded: ${yesterdayYmd}, Fresh: ${todayYmd}...`);

  try {
    const rawChallenges = await fetchFirestoreRestCollection("yptChallenges");
    const activeChallenges = rawChallenges
      .map((d) => ({ id: d.id, ...d.data } as any))
      .filter((c) => !c.isDeleted && c.status !== 'completed');

    if (activeChallenges.length === 0) {
      console.log("[YPT 5:15 AM REST FINALIZER] No active challenges found.");
      return;
    }

    for (const challenge of activeChallenges) {
      try {
        const groupIds = (challenge.groups || []).map((g: any) => g.id || g.gid || g)
          .concat(challenge.yptGroupId ? [challenge.yptGroupId] : [])
          .concat(challenge.groupIds || [])
          .concat(challenge.targetGroupIds || []);

        const { members: liveMembers } = await fetchYptRosterForChallengeNode(groupIds);

        // STEP A: Lock & Finalize Yesterday's Snapshot
        const yesterdaySnapData = await fetchFirestoreRestDoc(`yptChallenges/${challenge.id}/dailySnapshots/${yesterdayYmd}`);
        const freshChallengeData = await fetchFirestoreRestDoc(`yptChallenges/${challenge.id}`);

        let existingHwms: Record<string, number> = {};
        let existingMaxContHwms: Record<string, number> = {};
        let challengeDailyHwms: Record<string, number> = {};
        let challengeDailyMaxContHwms: Record<string, number> = {};
        let challengeDailyCompletedChallenges: Record<string, number[]> = {};

        if (freshChallengeData) {
          if (freshChallengeData.dailyHighWaterMarks && typeof freshChallengeData.dailyHighWaterMarks === 'object') {
            challengeDailyHwms = { ...freshChallengeData.dailyHighWaterMarks };
          }
          if (freshChallengeData.dailyMaxContinuousHighWaterMarks && typeof freshChallengeData.dailyMaxContinuousHighWaterMarks === 'object') {
            challengeDailyMaxContHwms = { ...freshChallengeData.dailyMaxContinuousHighWaterMarks };
          }
          if (freshChallengeData.dailyCompletedChallenges && typeof freshChallengeData.dailyCompletedChallenges === 'object') {
            challengeDailyCompletedChallenges = { ...freshChallengeData.dailyCompletedChallenges };
          }
        }

        if (yesterdaySnapData) {
          if (yesterdaySnapData.highWaterMarks) existingHwms = { ...yesterdaySnapData.highWaterMarks };
          if (yesterdaySnapData.maxContinuousHighWaterMarks) existingMaxContHwms = { ...yesterdaySnapData.maxContinuousHighWaterMarks };
          if (yesterdaySnapData.memberSnapshots) {
            for (const [h, m] of Object.entries(yesterdaySnapData.memberSnapshots)) {
              existingHwms[h] = Math.max(existingHwms[h] || 0, (m as any).hoursStudied || 0);
              existingMaxContHwms[h] = Math.max(existingMaxContHwms[h] || 0, (m as any).maxContinuousMs || 0);
              if (Array.isArray((m as any).completedNativeChallengeIds) && (m as any).completedNativeChallengeIds.length > 0) {
                const prev = challengeDailyCompletedChallenges[h] || [];
                challengeDailyCompletedChallenges[h] = Array.from(new Set([...prev, ...(m as any).completedNativeChallengeIds]));
              }
            }
          }
        }

        const mode = challenge.mode || 'team';
        const isSoloMode = mode === 'individual';

        const finalizedMemberSnapshots: Record<string, any> = {};
        const finalizedMemberRecords: any[] = [];
        const teamStandingsDraft: Array<{ teamId: string; teamName: string; dayHours: number; dayPoints: number }> = [];
        let participantStandings: Array<{ yptUd?: number; yptHandle: string; dayHours: number; dayPoints: number; rank: number }> = [];
        let dayTotalHours = 0;
        let dayTotalPoints = 0;
        let activeMemberCount = 0;

        if (isSoloMode) {
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

            // 4:59 AM Rule: Do not pull live running timer at 5:15 AM for yesterday
            const prevStoredSm = challengeDailyHwms[resolvedUdKey] || (existingHwms[cleanHandle] ? Math.round(existingHwms[cleanHandle] * 3600000) : 0);
            const peakSm = prevStoredSm;
            const peakHours = Math.round((peakSm / 3600000) * 100) / 100;
            existingHwms[cleanHandle] = peakHours;

            const prevMaxContStored = challengeDailyMaxContHwms[resolvedUdKey] || existingMaxContHwms[cleanHandle] || 0;
            const peakMaxContMs = prevMaxContStored;
            existingMaxContHwms[cleanHandle] = peakMaxContMs;

            if (peakHours > 0) activeMemberCount++;
            dayTotalHours += peakHours;

            const memberCompletedChallenges = challengeDailyCompletedChallenges[resolvedUdKey] || challengeDailyCompletedChallenges[cleanHandle] || [];

            const calculated = calculatePointsFromRulesNode(
              peakHours,
              challenge.rules,
              [],
              memberCompletedChallenges,
              true, // Apply penalty on final lock
              peakMaxContMs
            );

            dayTotalPoints += calculated.netPoints;

            const hasCompletedActiveChallenge = challenge.nativeYptChallengeId
              ? memberCompletedChallenges.includes(Number(challenge.nativeYptChallengeId))
              : (memberCompletedChallenges.length > 0);

            const finalSnapshotItem = {
              handle: liveMember?.n || p.yptHandle || cleanHandle,
              nickname: liveMember?.n || p.yptHandle || cleanHandle,
              rawYptUd: resolvedUd,
              yptUd: resolvedUd,
              hoursStudied: peakHours,
              studyMs: peakSm,
              maxContinuousMs: peakMaxContMs,
              isCurrentlyStudying: false,
              isStudying: false,
              completedNativeChallengeIds: memberCompletedChallenges,
              hasCompleted: hasCompletedActiveChallenge,
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

            finalizedMemberRecords.push({
              yptHandle: liveMember?.n || p.yptHandle || cleanHandle,
              userId: resolvedUd ? String(resolvedUd) : undefined,
              hoursStudied: peakHours,
              basePoints: calculated.baseStudyPoints,
              bonusPoints: calculated.bonusPoints,
              penaltyPoints: calculated.penaltyPoints || 0,
              netPoints: calculated.netPoints,
              isCurrentlyStudying: false,
              appliedRules: calculated.appliedRules,
              completedChallengeIds: memberCompletedChallenges,
            });
          });

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

              // 4:59 AM Rule: Use peak captured up to 4:59 AM
              const prevStoredSm = challengeDailyHwms[resolvedUdKey] || (existingHwms[cleanHandle] ? Math.round(existingHwms[cleanHandle] * 3600000) : 0);
              const peakSm = prevStoredSm;
              const peakHours = Math.round((peakSm / 3600000) * 100) / 100;
              existingHwms[cleanHandle] = peakHours;

              const prevMaxContStored = challengeDailyMaxContHwms[resolvedUdKey] || existingMaxContHwms[cleanHandle] || 0;
              const peakMaxContMs = prevMaxContStored;
              existingMaxContHwms[cleanHandle] = peakMaxContMs;

              if (peakHours > 0) activeMemberCount++;
              dayTotalHours += peakHours;
              teamDailyHours += peakHours;

              const memberCompletedChallenges = challengeDailyCompletedChallenges[resolvedUdKey] || challengeDailyCompletedChallenges[cleanHandle] || [];

              const calculated = calculatePointsFromRulesNode(
                peakHours,
                challenge.rules,
                [],
                memberCompletedChallenges,
                true, // Apply penalty on final lock
                peakMaxContMs
              );

              teamDailyPoints += calculated.netPoints;

              const hasCompletedActiveChallenge = challenge.nativeYptChallengeId
                ? memberCompletedChallenges.includes(Number(challenge.nativeYptChallengeId))
                : (memberCompletedChallenges.length > 0);

              finalizedMemberSnapshots[cleanHandle] = {
                handle: liveMember?.n || cleanHandle,
                rawYptUd: liveMember?.ud,
                hoursStudied: peakHours,
                studyMs: Math.round(peakHours * 3600000),
                maxContinuousMs: peakMaxContMs,
                isCurrentlyStudying: false,
                isStudying: false,
                completedNativeChallengeIds: memberCompletedChallenges,
                hasCompleted: hasCompletedActiveChallenge,
                basePoints: calculated.baseStudyPoints,
                bonusPoints: calculated.bonusPoints,
                penaltyPoints: calculated.penaltyPoints,
                netPoints: calculated.netPoints,
                appliedRuleBreakdown: calculated.appliedRules,
                status: 'active',
                lastSyncedAt: new Date().toISOString(),
              };

              finalizedMemberRecords.push({
                yptHandle: liveMember?.n || cleanHandle,
                userId: resolvedUd ? String(resolvedUd) : undefined,
                hoursStudied: peakHours,
                basePoints: calculated.baseStudyPoints,
                bonusPoints: calculated.bonusPoints,
                penaltyPoints: calculated.penaltyPoints || 0,
                netPoints: calculated.netPoints,
                isCurrentlyStudying: false,
                appliedRules: calculated.appliedRules,
                completedChallengeIds: memberCompletedChallenges,
              });
            });

            teamStandingsDraft.push({
              teamId: team.id,
              teamName: team.name || `Team ${team.id}`,
              dayHours: Math.round(teamDailyHours * 100) / 100,
              dayPoints: teamDailyPoints,
            });

            dayTotalPoints += teamDailyPoints;
          });

          teamStandingsDraft.sort((a, b) => b.dayPoints - a.dayPoints || b.dayHours - a.dayHours);
        }

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
          memberRecords: finalizedMemberRecords,
          teamStandings: isSoloMode ? [] : teamStandings,
          participantStandings: isSoloMode ? participantStandings : undefined,
          highWaterMarks: existingHwms,
          maxContinuousHighWaterMarks: existingMaxContHwms,
          isAutoClosed: true,
          closedAt: Date.now(),
        };

        // Write locked snapshot for yesterday via REST
        await setFirestoreRestDoc(`yptChallenges/${challenge.id}/dailySnapshots/${yesterdayYmd}`, lockedYesterdayData, true);

        // STEP B: Check if Challenge has reached its End Date
        const challengeEndDateYmd = getChallengeEndDateYmdNode(challenge);
        const isChallengeConcluded = yesterdayYmd >= challengeEndDateYmd;

        if (isChallengeConcluded) {
          await updateFirestoreRestDoc(`yptChallenges/${challenge.id}`, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            completedBy: 'cron_system',
            autoCompletedReason: `Reached end date ${challengeEndDateYmd} and finalized last day ${yesterdayYmd}.`,
          });
          console.log(`[YPT 5:15 AM REST FINALIZER] Challenge ${challenge.id} auto-completed.`);
        } else {
          // STEP C: Create Fresh Open Snapshot for Today (dateYmd = todayYmd)
          const todaySnapData = await fetchFirestoreRestDoc(`yptChallenges/${challenge.id}/dailySnapshots/${todayYmd}`);
          if (!todaySnapData) {
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
              memberRecords: [],
              teamStandings: isSoloMode ? [] : initialTeamStandings,
              participantStandings: isSoloMode ? initialParticipantStandings : undefined,
              highWaterMarks: {},
              maxContinuousHighWaterMarks: {},
              lastSyncedAt: new Date().toISOString(),
            };

            await setFirestoreRestDoc(`yptChallenges/${challenge.id}/dailySnapshots/${todayYmd}`, freshDayData, true);

            // Reset daily high water marks on main challenge doc
            await updateFirestoreRestDoc(`yptChallenges/${challenge.id}`, {
              dailyHighWaterMarks: {},
              dailyMaxContinuousHighWaterMarks: {},
              dailyCompletedChallenges: {},
              lastDailySnapshotDate: todayYmd,
              lastSyncedAt: new Date().toISOString(),
            });
          }
          console.log(`[YPT 5:15 AM REST FINALIZER] Successfully finalized ${yesterdayYmd} and created open snapshot for ${todayYmd} in challenge ${challenge.id} via REST API.`);
        }
      } catch (chErr) {
        console.error(`[YPT 5:15 AM REST FINALIZER] Error processing challenge ${challenge.id}:`, chErr);
      }
    }
  } catch (restErr) {
    console.error("[YPT 5:15 AM REST FINALIZER] Fatal error in REST finalizer:", restErr);
  }
}

/**
 * 5:15 AM IST Daily Finalizer & Day Transition Protocol:
 * - Runs daily at 5:15 AM IST (23:45 UTC).
 * - Finalizes yesterday's snapshot with full penalties and sets isLocked: true, lockedBy: 'cron_system'.
 * - Creates a fresh open snapshot for today.
 * - Resilient Error 7 Handler: Automatically falls back to Google Cloud Firestore REST API with API Key.
 */
async function execute515AmYptFinalizer(adminDb?: admin.firestore.Firestore) {
  if (!adminDb) {
    console.log("[YPT 5:15 AM IST FINALIZER] No Admin DB instance provided. Executing via Firestore REST API fallback...");
    await execute515AmYptFinalizerViaRest();
    return;
  }

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
          .concat(challenge.groupIds || [])
          .concat(challenge.targetGroupIds || []);

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
        let challengeDailyCompletedChallenges: Record<string, number[]> = {};
        const freshChallengeDoc = await challengeDocRef.get();
        if (freshChallengeDoc.exists) {
          const chData = freshChallengeDoc.data() as any;
          if (chData?.dailyHighWaterMarks && typeof chData.dailyHighWaterMarks === 'object') {
            challengeDailyHwms = { ...chData.dailyHighWaterMarks };
          }
          if (chData?.dailyMaxContinuousHighWaterMarks && typeof chData.dailyMaxContinuousHighWaterMarks === 'object') {
            challengeDailyMaxContHwms = { ...chData.dailyMaxContinuousHighWaterMarks };
          }
          if (chData?.dailyCompletedChallenges && typeof chData.dailyCompletedChallenges === 'object') {
            challengeDailyCompletedChallenges = { ...chData.dailyCompletedChallenges };
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
              if (Array.isArray((m as any).completedNativeChallengeIds) && (m as any).completedNativeChallengeIds.length > 0) {
                const prev = challengeDailyCompletedChallenges[h] || [];
                challengeDailyCompletedChallenges[h] = Array.from(new Set([...prev, ...(m as any).completedNativeChallengeIds]));
              }
            }
          }
        }

        const mode = challenge.mode || 'team';
        const isSoloMode = mode === 'individual';

        const finalizedMemberSnapshots: Record<string, any> = {};
        const finalizedMemberRecords: any[] = [];
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

            // Phase 2 4:59 AM Rule: Do NOT pull live running timer at 5:15 AM for yesterday
            const prevStoredSm = challengeDailyHwms[resolvedUdKey] || (existingHwms[cleanHandle] ? Math.round(existingHwms[cleanHandle] * 3600000) : 0);
            const peakSm = prevStoredSm;
            const peakHours = Math.round((peakSm / 3600000) * 100) / 100;
            existingHwms[cleanHandle] = peakHours;

            const prevMaxContStored = challengeDailyMaxContHwms[resolvedUdKey] || existingMaxContHwms[cleanHandle] || 0;
            const peakMaxContMs = prevMaxContStored;
            existingMaxContHwms[cleanHandle] = peakMaxContMs;

            if (peakHours > 0) activeMemberCount++;
            dayTotalHours += peakHours;

            const memberCompletedChallenges = challengeDailyCompletedChallenges[resolvedUdKey] || challengeDailyCompletedChallenges[cleanHandle] || [];

            // Final lock applies penalties!
            const calculated = calculatePointsFromRulesNode(
              peakHours,
              challenge.rules,
              [],
              memberCompletedChallenges,
              true, // Apply penalty on final lock
              peakMaxContMs
            );

            dayTotalPoints += calculated.netPoints;

            const hasCompletedActiveChallenge = challenge.nativeYptChallengeId
              ? memberCompletedChallenges.includes(Number(challenge.nativeYptChallengeId))
              : (memberCompletedChallenges.length > 0);

            const finalSnapshotItem = {
              handle: liveMember?.n || p.yptHandle || cleanHandle,
              nickname: liveMember?.n || p.yptHandle || cleanHandle,
              rawYptUd: resolvedUd,
              yptUd: resolvedUd,
              hoursStudied: peakHours,
              studyMs: peakSm,
              maxContinuousMs: peakMaxContMs,
              isCurrentlyStudying: false, // Day concluded
              isStudying: false,
              completedNativeChallengeIds: memberCompletedChallenges,
              hasCompleted: hasCompletedActiveChallenge,
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

            finalizedMemberRecords.push({
              yptHandle: liveMember?.n || p.yptHandle || cleanHandle,
              userId: resolvedUd ? String(resolvedUd) : undefined,
              hoursStudied: peakHours,
              basePoints: calculated.baseStudyPoints,
              bonusPoints: calculated.bonusPoints,
              penaltyPoints: calculated.penaltyPoints || 0,
              netPoints: calculated.netPoints,
              isCurrentlyStudying: false,
              appliedRules: calculated.appliedRules,
              completedChallengeIds: memberCompletedChallenges,
            });
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

              // Phase 2 4:59 AM Rule: Do NOT pull live running timer at 5:15 AM for yesterday
              const prevStoredSm = challengeDailyHwms[resolvedUdKey] || (existingHwms[cleanHandle] ? Math.round(existingHwms[cleanHandle] * 3600000) : 0);
              const peakSm = prevStoredSm;
              const peakHours = Math.round((peakSm / 3600000) * 100) / 100;
              existingHwms[cleanHandle] = peakHours;

              const prevMaxContStored = challengeDailyMaxContHwms[resolvedUdKey] || existingMaxContHwms[cleanHandle] || 0;
              const peakMaxContMs = prevMaxContStored;
              existingMaxContHwms[cleanHandle] = peakMaxContMs;

              if (peakHours > 0) activeMemberCount++;
              dayTotalHours += peakHours;
              teamDailyHours += peakHours;

              const memberCompletedChallenges = challengeDailyCompletedChallenges[resolvedUdKey] || challengeDailyCompletedChallenges[cleanHandle] || [];

              // Final lock applies penalties!
              const calculated = calculatePointsFromRulesNode(
                peakHours,
                challenge.rules,
                [],
                memberCompletedChallenges,
                true, // Apply penalty on final lock
                peakMaxContMs
              );

              teamDailyPoints += calculated.netPoints;

              const hasCompletedActiveChallenge = challenge.nativeYptChallengeId
                ? memberCompletedChallenges.includes(Number(challenge.nativeYptChallengeId))
                : (memberCompletedChallenges.length > 0);

              finalizedMemberSnapshots[cleanHandle] = {
                handle: liveMember?.n || cleanHandle,
                rawYptUd: liveMember?.ud,
                hoursStudied: peakHours,
                studyMs: Math.round(peakHours * 3600000),
                maxContinuousMs: peakMaxContMs,
                isCurrentlyStudying: false, // Day concluded
                isStudying: false,
                completedNativeChallengeIds: memberCompletedChallenges,
                hasCompleted: hasCompletedActiveChallenge,
                basePoints: calculated.baseStudyPoints,
                bonusPoints: calculated.bonusPoints,
                penaltyPoints: calculated.penaltyPoints,
                netPoints: calculated.netPoints,
                appliedRuleBreakdown: calculated.appliedRules,
                status: 'active',
                lastSyncedAt: new Date().toISOString(),
              };

              finalizedMemberRecords.push({
                yptHandle: liveMember?.n || cleanHandle,
                userId: resolvedUd ? String(resolvedUd) : undefined,
                hoursStudied: peakHours,
                basePoints: calculated.baseStudyPoints,
                bonusPoints: calculated.bonusPoints,
                penaltyPoints: calculated.penaltyPoints || 0,
                netPoints: calculated.netPoints,
                isCurrentlyStudying: false,
                appliedRules: calculated.appliedRules,
                completedChallengeIds: memberCompletedChallenges,
              });
            });

            teamStandingsDraft.push({
              teamId: team.id,
              teamName: team.name || `Team ${team.id}`,
              dayHours: Math.round(teamDailyHours * 100) / 100,
              dayPoints: teamDailyPoints,
            });

            dayTotalPoints += teamDailyPoints;
          });

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
            memberRecords: finalizedMemberRecords,
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
        }

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
            const topTeam = sortedTeams[0];
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
              memberRecords: [],
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
              dailyCompletedChallenges: {},
              lastDailySnapshotDate: todayYmd,
              lastSyncedAt: new Date().toISOString(),
            });
          }

          console.log(`[YPT 5:15 AM IST FINALIZER] Successfully finalized ${yesterdayYmd} and created open snapshot for ${todayYmd} in ${challenge.id}.`);
        }
      } catch (chErr: any) {
        if (chErr && (chErr.code === 7 || chErr.code === 16 || chErr.message?.includes("PERMISSION_DENIED") || chErr.message?.includes("ADC") || chErr.message?.includes("UNAUTHENTICATED"))) {
          console.warn(`[YPT 5:15 AM IST FINALIZER] Challenge ${challenge.id} threw Error 7 (PERMISSION_DENIED). Falling back to REST API finalizer...`);
          await execute515AmYptFinalizerViaRest();
          return;
        }
        console.error(`[YPT 5:15 AM IST FINALIZER] Error processing challenge ${challenge.id}:`, chErr);
      }
    }
  } catch (err: any) {
    if (err && (err.code === 7 || err.code === 16 || err.message?.includes("PERMISSION_DENIED") || err.message?.includes("ADC") || err.message?.includes("UNAUTHENTICATED"))) {
      console.warn("[YPT 5:15 AM IST FINALIZER] Admin Firestore encountered Error 7 (PERMISSION_DENIED). Seamlessly executing finalizer via authenticated Firestore REST API fallback...");
      await execute515AmYptFinalizerViaRest();
    } else {
      console.warn("[YPT 5:15 AM IST FINALIZER] Admin Firestore threw error. Executing via authenticated Firestore REST API fallback...", err);
      await execute515AmYptFinalizerViaRest();
    }
  }
}

export function startCron() {
  if (db) {
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
    initDynamicYptSync(db);
  } else {
    console.warn("Admin DB instance not initialized with ADC; YPT background cron services will run in REST API Fallback Mode.");
    updateYptSyncCronSchedule(null as any, 15);
  }

  console.log("Registered 04:55 AM IST (23:25 UTC) YPT Pre-Reset Peak Capture cron job.");
  // Runs daily at 23:25 UTC (04:55 AM IST): captures absolute peak study hours before YPT 05:00 AM IST reset
  cron.schedule("25 23 * * *", async () => {
    console.log("[YPT 4:55 AM IST PRE-RESET] Executing final pre-reset peak capture...");
    await execute15MinYptSync(db);
  });

  console.log("Registered 05:15 AM IST (23:45 UTC) YPT Daily Finalizer & Day Transition cron job.");
  // Runs daily at 23:45 UTC (05:15 AM IST): locks yesterday's snapshot and opens fresh today snapshot
  cron.schedule("45 23 * * *", async () => {
    await execute515AmYptFinalizer(db);
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

