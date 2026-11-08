import express from "express";
import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import admin from "firebase-admin";
import { v2 as cloudinary } from "cloudinary";
import { TinyFish, FetchFormat } from "@tiny-fish/sdk";
import {
  initFirebaseAdmin,
  getAdminDb as getUnifiedAdminDb,
  getFirebaseConfig,
} from "../../firebase-admin-init.js";

export const firebaseConfig = getFirebaseConfig();
initFirebaseAdmin();

export const getAdminDb = () => {
  return getUnifiedAdminDb();
};

// Initialize Cloudinary (Lazy / Environment Based)
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };

/**
 * ============================================================================
 * DATE, TIME & HANDLE HELPERS (Backend / Node)
 * ============================================================================
 */

import {
  getIstDate as getIstDateNode,
  getYptDayYmd as getYptDayYmdNode,
  getYesterdayYptDayYmd as getYesterdayYptDayYmdNode,
  getYmdFromDateOrString as getYmdFromDateOrStringNode,
  getChallengeEndDateYmd as getChallengeEndDateYmdNode,
  normalizeHandle as normalizeHandleNode,
  areYptHandlesMatching as areHandlesMatchingNode,
} from "../../src/utils/yptUtils.js";
import { calculatePointsFromRules } from "../../src/services/ypt/yptPointEngine.js";

export {
  getIstDateNode,
  getYptDayYmdNode,
  getYesterdayYptDayYmdNode,
  getYmdFromDateOrStringNode,
  getChallengeEndDateYmdNode,
  normalizeHandleNode,
  areHandlesMatchingNode,
};

/**
 * ============================================================================
 * FIRESTORE REST API ENCODING / DECODING & AUTONOMOUS FALLBACK ENGINE
 * ============================================================================
 */

export function encodeFirestoreRestValue(val: any): any {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === "boolean") {
    return { booleanValue: val };
  }
  if (typeof val === "number") {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === "string") {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(encodeFirestoreRestValue),
      },
    };
  }
  if (typeof val === "object") {
    if (val._methodName === "serverTimestamp" || val.constructor?.name === "FieldValue") {
      return { timestampValue: new Date().toISOString() };
    }
    if (typeof val.toDate === "function") {
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

export function encodeFirestoreRestFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = encodeFirestoreRestValue(v);
    }
  }
  return fields;
}

export function parseFirestoreRestFields(fields: any): any {
  if (!fields || typeof fields !== "object") return null;
  const result: any = {};
  for (const [key, value] of Object.entries(fields) as [string, any][]) {
    if (!value || typeof value !== "object") continue;
    if ("stringValue" in value) result[key] = value.stringValue;
    else if ("booleanValue" in value) result[key] = value.booleanValue;
    else if ("integerValue" in value) result[key] = parseInt(value.integerValue, 10);
    else if ("doubleValue" in value) result[key] = parseFloat(value.doubleValue);
    else if ("timestampValue" in value) result[key] = value.timestampValue;
    else if ("mapValue" in value) result[key] = parseFirestoreRestFields(value.mapValue?.fields);
    else if ("arrayValue" in value) {
      result[key] = (value.arrayValue?.values || []).map((item: any) =>
        parseFirestoreRestFields({ temp: item })?.temp
      );
    } else if ("nullValue" in value) result[key] = null;
  }
  return result;
}

export function getFirestoreRestConfig(): {
  baseUrl: string;
  apiKey: string;
  projectId: string;
  dbId: string;
} {
  const fbConfig = getFirebaseConfig();
  const projectId = fbConfig.projectId || "project-8cd430e4-1498-4f8c-b8f";
  const dbId = fbConfig.firestoreDatabaseId || "(default)";
  const apiKey =
    fbConfig.apiKey ||
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyD_6GOGVqF_DJqhalF0gocMOjckhhWoWRI";
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents`;
  return { baseUrl, apiKey, projectId, dbId };
}

export async function fetchFirestoreRestDoc(docPath: string): Promise<any | null> {
  const { baseUrl, apiKey } = getFirestoreRestConfig();
  const cleanPath = docPath.replace(/^\//, "");
  const url = `${baseUrl}/${cleanPath}${apiKey ? `?key=${apiKey}` : ""}`;
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

export async function fetchFirestoreRestCollection(
  collectionPath: string
): Promise<Array<{ id: string; data: any }>> {
  const { baseUrl, apiKey } = getFirestoreRestConfig();
  const cleanPath = collectionPath.replace(/^\//, "");
  const url = `${baseUrl}/${cleanPath}?pageSize=300${apiKey ? `&key=${apiKey}` : ""}`;
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
        const docName = doc.name || "";
        const docId = docName.split("/").pop() || "";
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

export async function setFirestoreRestDoc(
  docPath: string,
  data: any,
  merge: boolean = true
): Promise<any> {
  const { apiKey, projectId, dbId } = getFirestoreRestConfig();
  const cleanPath = docPath.replace(/^\//, "");
  const docFullName = `projects/${projectId}/databases/${dbId}/documents/${cleanPath}`;
  const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents:commit${
    apiKey ? `?key=${apiKey}` : ""
  }`;

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
      const fieldMaskParams = merge
        ? Object.keys(data)
            .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
            .join("&")
        : "";
      const patchUrl = `https://firestore.googleapis.com/v1/${docFullName}?${
        fieldMaskParams ? `${fieldMaskParams}&` : ""
      }${apiKey ? `key=${apiKey}` : ""}`;
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

export async function updateFirestoreRestDoc(docPath: string, data: any): Promise<any> {
  return setFirestoreRestDoc(docPath, data, true);
}

/**
 * ============================================================================
 * YPT NODE AUTHENTICATION, ROSTER FETCHING & POINT ENGINE
 * ============================================================================
 */

let nodeYptTokenCache: { token: string; coid: string; expiresAt: number } | null = null;

export async function getYptAuthTokenNode(
  adminDb?: any
): Promise<{ token: string; coid: string } | null> {
  const now = Date.now();
  if (nodeYptTokenCache && nodeYptTokenCache.expiresAt > now) {
    return { token: nodeYptTokenCache.token, coid: nodeYptTokenCache.coid };
  }

  const explicitJwt = process.env.YPT_JWT || process.env.YPT_TOKEN;
  const configuredCoid = process.env.YPT_COID || "89";
  if (explicitJwt) {
    nodeYptTokenCache = {
      token: explicitJwt,
      coid: configuredCoid,
      expiresAt: now + 60 * 60 * 1000,
    };
    return nodeYptTokenCache;
  }

  let email = (process.env.YPT_EMAIL || "").trim();
  let password = process.env.YPT_PASSWORD || "";

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

  if (
    !email ||
    !password ||
    email === "bot@example.com" ||
    password === "YOUR_YPT_PASSWORD" ||
    !email.includes("@")
  ) {
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

        const resolvedCoid = String(
          coid && coid !== "0" && coid !== 0 ? coid : process.env.YPT_COID || "89"
        );

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

export async function fetchYptRosterForChallengeNode(
  groupIds: (string | number)[],
  adminDb?: any
): Promise<{ members: any[]; nativeChallenges: any[]; errors: string[] }> {
  const errors: string[] = [];
  const auth = await getYptAuthTokenNode(adminDb);
  if (!auth) {
    const errMsg =
      "YPT authentication failed: No valid YPT credentials found or login rejected by pi.tgclab.com.";
    console.warn(`[YPT Cron] ${errMsg}`);
    errors.push(errMsg);
    return { members: [], nativeChallenges: [], errors };
  }

  const yptHeaders = {
    authorization: `JWT ${auth.token}`,
    "User-Agent": "Dart/3.11 (dart:io)",
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    coid: String(auth.coid),
  };

  let gids = groupIds.map(String).filter(Boolean);
  if (gids.length === 0) {
    try {
      const gRes = await fetch("https://pi.tgclab.com/group/groups/v2", { headers: yptHeaders });
      if (gRes.ok) {
        const gData: any = await gRes.json();
        const rawGroups = [
          ...(gData.gs || []),
          ...(gData.ms || []),
          ...(gData.cs || []),
          ...(gData.ps || []),
        ];
        gids = rawGroups.map((g: any) => String(g.id)).filter(Boolean);
      } else {
        errors.push(
          `Failed to fetch user groups list from YPT: HTTP ${gRes.status} ${gRes.statusText}`
        );
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
        const mUrl = `https://pi.tgclab.com/logs/group/members/v2?groupID=${encodeURIComponent(
          gid
        )}&countryID=${encodeURIComponent(auth.coid)}&isLooking=true&version=810046`;
        const mRes = await fetch(mUrl, { headers: yptHeaders });
        if (mRes.ok) {
          const mData: any = await mRes.json();
          if (Array.isArray(mData.ms)) {
            allMembers.push(...mData.ms);
            for (const m of mData.ms) {
              if (m?.cls) {
                if (typeof m.cls === "object" && !Array.isArray(m.cls)) {
                  for (const [chIdStr, chItem] of Object.entries(m.cls)) {
                    const chId = Number(chIdStr);
                    if (chId && !isNaN(chId)) {
                      rawChallenges.push({
                        id: chId,
                        ...(typeof chItem === "object" ? chItem : {}),
                      });
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

export function calculatePointsFromRulesNode(
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
  appliedRules: Array<{
    ruleId: string;
    ruleName: string;
    emoji: string;
    points: number;
    type: "bonus" | "penalty" | "base" | "milestone";
  }>;
} {
  const res = calculatePointsFromRules(
    hoursStudied,
    rules,
    detectedEmojis,
    false,
    completedNativeChallengeIds,
    applyPenalty,
    maxContinuousMs
  );
  return {
    baseStudyPoints: res.baseStudyPoints,
    bonusPoints: res.bonusPoints,
    penaltyPoints: res.penaltyPoints,
    netPoints: res.netPoints,
    appliedRules: res.appliedRules as any,
  };
}

/**
 * ============================================================================
 * SHARED GEMINI PROXY, AUTH MIDDLEWARE & WEB SEARCH HELPERS
 * ============================================================================
 */

export const customWebSearchDeclaration = {
  name: "custom_web_search",
  description: "Search the web for information using a custom web search tool.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The optimized search query.",
      },
      search_type: {
        type: Type.STRING,
        description: "The type of search.",
        enum: ["news_and_facts", "semantic_concept", "general"],
      },
    },
    required: ["query", "search_type"],
  },
};

export const inMemorySearchLogs: any[] = [];

export const writeWebhookLog = async (data: any) => {
  try {
    const timestamp = new Date().toISOString();
    await getAdminDb()
      .collection("cloudinary_webhook_logs")
      .add({
        ...data,
        timestamp: timestamp,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (error: any) {
    const errStr = error ? String(error) + (error.message || "") + (error.details || "") : "";
    if (
      error.code === 7 ||
      error.code === 5 ||
      errStr.includes("PERMISSION_DENIED") ||
      errStr.includes("NOT_FOUND") ||
      errStr.includes("ADC restrictions")
    ) {
      // Ignore
    } else {
      console.error("Failed to write webhook log to Firestore:", error);
    }
  }
};

export const getAiClient = (customApiKey?: string) => {
  const keyToUse = customApiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!keyToUse)
    throw new Error("No Gemini API key available. Please add an API key.");
  return new GoogleGenAI({ apiKey: keyToUse });
};

export const fetchWithRetry = async (
  fn: () => Promise<any>,
  retries = 2,
  delayMs = 1500
) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (i === retries) throw error;
      const msg = error.message || String(error);
      if (msg.includes("503") || msg.includes("429") || msg.includes("high demand")) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw error;
    }
  }
};

let cachedGlobalGeminiConfig: { data: any; expiresAt: number } | null = null;
let adminSdkGlobalConfigFailed = false;
const GLOBAL_CONFIG_CACHE_TTL_MS = 60 * 1000;

export function invalidateGlobalGeminiConfigCache() {
  cachedGlobalGeminiConfig = null;
}

export async function getGlobalGeminiConfigRest(): Promise<any> {
  try {
    const projectId = firebaseConfig.projectId;
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    if (!projectId) return null;

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/system_config/global_gemini`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.fields) {
      return parseFirestoreRestFields(data.fields);
    }
  } catch (e) {
    // Silent catch
  }
  return null;
}

const VALID_ACTIVE_MODELS = new Set([
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
]);

const FLASH_DESCENDING_LADDER = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
];

const FLASH_LITE_DESCENDING_LADDER = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
];

const PRO_DESCENDING_LADDER = [
  "gemini-3.1-pro-preview",
  "gemini-2.5-pro",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
];

export const normalizeGeminiModel = (rawModel?: string): string => {
  if (!rawModel || typeof rawModel !== "string") return "gemini-3.5-flash-lite";
  const m = rawModel.trim().toLowerCase();

  // Pass valid active checkpoints directly through without downgrading
  if (VALID_ACTIVE_MODELS.has(m)) {
    return m;
  }

  // Discontinued checkpoints mapped to next descending active model
  if (m === "gemini-3.7-flash" || m.includes("3.7")) return "gemini-3.6-flash";
  if (m === "gemini-3.5-flash") return "gemini-3-flash-preview";

  // Normalize shorthand aliases if passed
  if (m === "gemini-3.1-pro") return "gemini-3.1-pro-preview";
  if (m === "gemini-3.0-flash" || m === "gemini-3-flash") return "gemini-3-flash-preview";

  if (m.includes("lite")) return "gemini-3.5-flash-lite";
  if (m.includes("pro")) return "gemini-3.1-pro-preview";
  if (m.includes("flash")) return "gemini-3.8-flash";

  return "gemini-3.5-flash-lite";
};

export const getDescendingFallbackChain = (rawPrimaryModel?: string): string[] => {
  const primary = normalizeGeminiModel(rawPrimaryModel);

  const liteIdx = FLASH_LITE_DESCENDING_LADDER.indexOf(primary);
  if (liteIdx !== -1) {
    return FLASH_LITE_DESCENDING_LADDER.slice(liteIdx);
  }

  const flashIdx = FLASH_DESCENDING_LADDER.indexOf(primary);
  if (flashIdx !== -1) {
    return FLASH_DESCENDING_LADDER.slice(flashIdx);
  }

  const proIdx = PRO_DESCENDING_LADDER.indexOf(primary);
  if (proIdx !== -1) {
    return PRO_DESCENDING_LADDER.slice(proIdx);
  }

  // Gemma or custom model fallback ladder
  return [primary, ...FLASH_LITE_DESCENDING_LADDER];
};

export const generateContentWithFallback = async (
  aiClient: any,
  payload: any,
  onModelChange?: (newModel: string) => Record<string, any> | void
): Promise<any> => {
  const chain = getDescendingFallbackChain(payload.model);
  let lastErr: any = null;

  for (let i = 0; i < chain.length; i++) {
    const candidateModel = chain[i];
    try {
      const updatedConfig = onModelChange ? onModelChange(candidateModel) : undefined;
      const response = await aiClient.models.generateContent({
        ...payload,
        model: candidateModel,
        ...(updatedConfig ? { config: updatedConfig } : {}),
      });
      (response as any).modelUsed = candidateModel;
      return response;
    } catch (err: any) {
      lastErr = err;
      if (i < chain.length - 1) {
        console.warn(
          `[Gemini Fallback] Model ${candidateModel} failed (${err?.message || err}), stepping down to ${chain[i + 1]}...`
        );
      }
    }
  }

  throw lastErr;
};

export const generateContentStreamWithFallback = async (aiClient: any, payload: any) => {
  const chain = getDescendingFallbackChain(payload.model);
  let lastErr: any = null;

  for (let i = 0; i < chain.length; i++) {
    const candidateModel = chain[i];
    try {
      const stream = await aiClient.models.generateContentStream({
        ...payload,
        model: candidateModel,
      });
      (stream as any).modelUsed = candidateModel;
      return stream;
    } catch (err: any) {
      lastErr = err;
      if (i < chain.length - 1) {
        console.warn(
          `[Gemini Stream Fallback] Model ${candidateModel} failed (${err?.message || err}), stepping down to ${chain[i + 1]}...`
        );
      }
    }
  }

  throw lastErr;
};

export const resolveGeminiProxyConfig = async (
  reqBody: any = {},
  reqHeaders: any = {},
  fallbackFeatureKey: string = "jarvis"
) => {
  let rawFeatureKey = reqBody.featureKey || reqHeaders["x-feature-key"] || fallbackFeatureKey;
  if (rawFeatureKey === "flashcards") rawFeatureKey = "vocab_extractor";
  if (rawFeatureKey === "mock_exam_generator") rawFeatureKey = "mock_score_extractor";
  const featureKey = rawFeatureKey;

  const clientApiKey = reqBody.customApiKey || reqHeaders["x-custom-api-key"];

  const now = Date.now();
  let globalConfig: any = null;

  if (cachedGlobalGeminiConfig && cachedGlobalGeminiConfig.expiresAt > now) {
    globalConfig = cachedGlobalGeminiConfig.data;
  } else {
    if (!adminSdkGlobalConfigFailed) {
      try {
        const snap = await getAdminDb().collection("system_config").doc("global_gemini").get();
        if (snap.exists) {
          globalConfig = snap.data();
        }
      } catch (err: any) {
        adminSdkGlobalConfigFailed = true;
      }
    }

    if (!globalConfig) {
      globalConfig = await getGlobalGeminiConfigRest();
    }

    if (globalConfig) {
      cachedGlobalGeminiConfig = {
        data: globalConfig,
        expiresAt: now + GLOBAL_CONFIG_CACHE_TTL_MS,
      };
    }
  }

  const featureSetting = globalConfig?.features?.[featureKey] || {
    enabled: false,
    defaultModel: "gemini-3.5-flash-lite",
    lockForNonKeyUsers: true,
    lockForKeyUsers: false,
  };

  if (clientApiKey && typeof clientApiKey === "string" && clientApiKey.trim().length > 0) {
    const keyToUse = clientApiKey.trim().replace(/^["']|["']$/g, "");
    const modelToUse = featureSetting.lockForKeyUsers
      ? normalizeGeminiModel(featureSetting.defaultModel)
      : normalizeGeminiModel(reqBody.model || featureSetting.defaultModel);

    return {
      apiKey: keyToUse,
      model: modelToUse,
      isGlobalKey: false,
      featureKey,
      aiClient: new GoogleGenAI({ apiKey: keyToUse }),
    };
  }

  if (!featureSetting.enabled) {
    throw {
      status: 403,
      message: `Feature '${featureKey}' is disabled by administrator or requires a personal Gemini API key. Please add your key in Settings.`,
    };
  }

  const globalApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!globalApiKey || globalApiKey.trim().length === 0) {
    throw {
      status: 500,
      message: "Server global GEMINI_API_KEY is not configured on the server.",
    };
  }

  const isLockedForNonKey = featureSetting.lockForNonKeyUsers !== false;
  const modelToUse = isLockedForNonKey
    ? normalizeGeminiModel(featureSetting.defaultModel)
    : normalizeGeminiModel(reqBody.model || featureSetting.defaultModel);

  return {
    apiKey: globalApiKey.trim(),
    model: modelToUse,
    isGlobalKey: true,
    featureKey,
    aiClient: new GoogleGenAI({ apiKey: globalApiKey.trim() }),
  };
};

export const requireAdminAuth = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    if (decodedToken.email === "mrityunjoyk29@gmail.com") {
      (req as any).user = decodedToken;
      return next();
    }

    const userDoc = await getAdminDb().collection("users").doc(decodedToken.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData?.role === "admin" || userData?.role === "owner") {
        (req as any).user = decodedToken;
        return next();
      }
    }

    return res.status(403).json({ error: "Forbidden: Requires admin privileges" });
  } catch (error: any) {
    console.error("Admin Auth Middleware Error:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
};

export const requireAdminStorageAuth = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_SECRET) {
      return res
        .status(500)
        .json({ error: "Cloudinary configuration is missing on server" });
    }

    if (!decodedToken.email) {
      return res.status(403).json({ error: "Forbidden: Missing email" });
    }

    (req as any).user = decodedToken;
    next();
  } catch (error: any) {
    console.error("Storage Auth Middleware Error:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
};

export const formatGeminiError = (error: any) => {
  try {
    const errStr = error.message || String(error);
    if (
      errStr.includes("503") ||
      errStr.includes("high demand") ||
      errStr.includes("429") ||
      errStr.includes("UNAVAILABLE") ||
      errStr.includes("overloaded") ||
      errStr.includes("resource exhausted") ||
      errStr.includes("RESOURCE_EXHAUSTED")
    ) {
      return "This AI model is currently experiencing high demand or quota limits. Please try again in a few moments or switch models in Settings.";
    }
    const jsonMatch = errStr.match(/\{.*\}/s);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error && parsed.error.message) {
        return parsed.error.message;
      }
    }
  } catch (e) {}
  return error.message || "Failed to process, please try again.";
};

async function fetchTavily(query: string) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("Tavily API Key missing");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, search_depth: "basic" }),
  });
  if (!response.ok) throw new Error(`Tavily error: ${response.status}`);
  const data = await response.json();
  return (data.results || []).map((r: any) => ({
    title: r.title,
    content: r.content,
    url: r.url,
  }));
}

async function fetchExa(query: string) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("Exa API Key missing");
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      numResults: 3,
      useAutoprompt: true,
      contents: { text: true },
    }),
  });
  if (!response.ok) throw new Error(`Exa error: ${response.status}`);
  const data = await response.json();
  return (data.results || []).map((r: any) => ({
    title: r.title,
    content: r.text,
    url: r.url,
  }));
}

async function fetchTinyfish(query: string) {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) throw new Error("Tinyfish API Key missing");
  const client = new TinyFish({ apiKey });
  const response = await client.search.query({ query });
  return (response.results || []).slice(0, 3).map((r: any) => ({
    title: r.title || "Search Result",
    content: r.snippet || "",
    url: r.url || "",
  }));
}

async function fetchPageWithTinyfish(url: string, _signal?: AbortSignal) {
  try {
    const apiKey = process.env.TINYFISH_API_KEY;
    if (!apiKey) return null;

    const client = new TinyFish({ apiKey });
    const response = await client.fetch.getContents({
      urls: [url],
      format: FetchFormat.Markdown,
    });

    if (response && response.results && response.results.length > 0) {
      await logSearchAttempt("Tinyfish Fetch", url, "success");
      return (response.results[0].text as string) || "";
    }

    await logSearchAttempt("Tinyfish Fetch", url, "error", "No results returned");
    return null;
  } catch (e: any) {
    await logSearchAttempt("Tinyfish Fetch", url, "error", e.message || String(e));
    return null;
  }
}

async function fetchPageWithJina(url: string, signal?: AbortSignal) {
  try {
    const apiKey = process.env.JINA_API_KEY;
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const response = await fetch("https://r.jina.ai/" + url, {
      signal,
      headers,
    });
    if (!response.ok) {
      await logSearchAttempt("Jina Fetch", url, "error", `Status: ${response.status}`);
      return null;
    }
    const text = await response.text();
    await logSearchAttempt("Jina Fetch", url, "success");
    return text;
  } catch (e: any) {
    await logSearchAttempt("Jina Fetch", url, "error", e.message || String(e));
    return null;
  }
}

async function getFullPageContent(url: string): Promise<string | null> {
  const globalController = new AbortController();
  const globalTimeoutId = setTimeout(() => globalController.abort(), 15000);

  try {
    const tfController = new AbortController();
    const tfTimeoutId = setTimeout(() => tfController.abort(), 7000);

    let content = await fetchPageWithTinyfish(url, tfController.signal);
    clearTimeout(tfTimeoutId);

    if (!content) {
      content = await fetchPageWithJina(url, globalController.signal);
    }

    clearTimeout(globalTimeoutId);
    return content;
  } catch (err: any) {
    clearTimeout(globalTimeoutId);
    return null;
  }
}

export async function logSearchAttempt(
  apiName: string,
  query: string,
  status: "success" | "error",
  errorMessage?: string
) {
  try {
    const db = getAdminDb();
    await db.collection("search_api_logs").add({
      apiName,
      query,
      status,
      ...(errorMessage ? { errorMessage } : {}),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    const errStr = err ? String(err) + (err.message || "") + (err.details || "") : "";
    if (
      err.code === 7 ||
      err.code === 5 ||
      errStr.includes("PERMISSION_DENIED") ||
      errStr.includes("NOT_FOUND") ||
      errStr.includes("ADC restrictions")
    ) {
      inMemorySearchLogs.unshift({
        id: "mem-" + Date.now() + Math.random().toString(36).substring(7),
        apiName,
        query,
        status,
        ...(errorMessage ? { errorMessage } : {}),
        createdAt: new Date().toISOString(),
      });
      if (inMemorySearchLogs.length > 100) inMemorySearchLogs.pop();
    } else {
      console.error(`Failed to write search log to Firestore for ${apiName}:`, err);
    }
  }
}

export async function performCustomSearch(
  query: string,
  searchType: string,
  customSearchApi: string = "auto"
) {
  let results: any = null;

  const tryTavily = async () => {
    console.log("Trying Tavily...");
    try {
      const res = await fetchTavily(query);
      await logSearchAttempt("Tavily", query, "success");
      return res;
    } catch (e: any) {
      await logSearchAttempt("Tavily", query, "error", e.message || String(e));
      throw e;
    }
  };
  const tryExa = async () => {
    console.log("Trying Exa...");
    try {
      const res = await fetchExa(query);
      await logSearchAttempt("Exa", query, "success");
      return res;
    } catch (e: any) {
      await logSearchAttempt("Exa", query, "error", e.message || String(e));
      throw e;
    }
  };
  const tryTinyfish = async () => {
    console.log("Trying Tinyfish...");
    try {
      const res = await fetchTinyfish(query);
      await logSearchAttempt("Tinyfish", query, "success");
      return res;
    } catch (e: any) {
      await logSearchAttempt("Tinyfish", query, "error", e.message || String(e));
      throw e;
    }
  };

  try {
    if (customSearchApi === "tavily") {
      try {
        results = await tryTavily();
      } catch (e) {
        console.error("Tavily failed (forced):", e);
      }
    } else if (customSearchApi === "exa") {
      try {
        results = await tryExa();
      } catch (e) {
        console.error("Exa failed (forced):", e);
      }
    } else if (customSearchApi === "tinyfish") {
      try {
        results = await tryTinyfish();
      } catch (e) {
        console.error("Tinyfish failed (forced):", e);
      }
    } else {
      if (searchType === "news_and_facts") {
        try {
          results = await tryTavily();
        } catch (e) {
          console.error("Tavily failed:", e);
          try {
            results = await tryTinyfish();
          } catch (e2) {
            console.error("Tinyfish failed:", e2);
            results = await tryExa();
          }
        }
      } else if (searchType === "semantic_concept") {
        try {
          results = await tryExa();
        } catch (e) {
          console.error("Exa failed:", e);
          try {
            results = await tryTavily();
          } catch (e2) {
            console.error("Tavily failed:", e2);
            results = await tryTinyfish();
          }
        }
      } else {
        try {
          results = await tryTinyfish();
        } catch (e) {
          console.error("Tinyfish failed:", e);
          try {
            results = await tryTavily();
          } catch (e2) {
            console.error("Tavily failed:", e2);
            results = await tryExa();
          }
        }
      }
    }
  } catch (finalError) {
    console.error("All search providers failed for query:", query, finalError);
    return { error: "Failed to retrieve search results." };
  }

  if (results && results.length > 0) {
    const topResults = results.slice(0, 2);
    const fullContents = await Promise.all(
      topResults.map(async (r: any) => {
        if (!r.url) return null;
        console.log(`Fetching full content for: ${r.url}`);
        return await getFullPageContent(r.url);
      })
    );

    topResults.forEach((r: any, idx: number) => {
      const fullText = fullContents[idx];
      if (fullText) {
        r.content = `[FULL PAGE EXTRACTED CONTENT]:\n${fullText.slice(0, 15000)}`;
      }
    });
  }

  return { results };
}
