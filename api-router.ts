import express from "express";
import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";
import { v2 as cloudinary } from "cloudinary";
import { TinyFish, FetchFormat } from '@tiny-fish/sdk';

const require = createRequire(import.meta.url);

let firebaseConfig: any = {};
try {
  firebaseConfig = require("./firebase-applet-config.json");
} catch (e: any) {
  console.warn("Could not lazily read firebase config:", e.message);
}

if (!admin.apps.length && firebaseConfig.projectId) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: firebaseConfig.projectId,
      });
    } catch (e: any) {
      console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", e.message);
      admin.initializeApp({ projectId: firebaseConfig.projectId });
    }
  } else {
    admin.initializeApp({ projectId: firebaseConfig.projectId });
  }
}

const getAdminDb = () => {
  return firebaseConfig.firestoreDatabaseId
    ? getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId)
    : admin.firestore();
};

const customWebSearchDeclaration = {
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

const inMemorySearchLogs: any[] = [];
const writeWebhookLog = async (data: any) => {
  try {
    const timestamp = new Date().toISOString();
    await getAdminDb()
      .collection("cloudinary_webhook_logs")
      .add({
        ...data,
        timestamp: timestamp,
        createdAt: admin.firestore.FieldValue.serverTimestamp(), // Keep accurate db time
      });
  } catch (error: any) {
    const errStr = error ? String(error) + (error.message || "") + (error.details || "") : "";
    if (error.code === 7 || error.code === 5 || errStr.includes("PERMISSION_DENIED") || errStr.includes("NOT_FOUND") || errStr.includes("ADC restrictions")) {
      // Ignore
    } else {
      console.error("Failed to write webhook log to Firestore:", error);
    }
  }
};

const app = express();

app.use((req, res, next) => {
  // If Vercel already parsed it into an object that is not a Buffer
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    (req as any)._body = true;
  }
  next();
});
app.use(
  express.json({
    limit: "50mb",
    verify: (req, res, buf) => {
      (req as any).rawBody = buf.toString();
    },
  }),
);

// Initialize Cloudinary (Lazy / Environment Based)
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Helper
const getAiClient = (customApiKey?: string) => {
  let keyToUse =
    customApiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!keyToUse)
    throw new Error("No Gemini API key available. Please add an API key.");
  return new GoogleGenAI({ apiKey: keyToUse });
};

// Helper to retry Gemini requests
const fetchWithRetry = async (
  fn: () => Promise<any>,
  retries = 2,
  delayMs = 1500,
) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (i === retries) throw error;
      const msg = error.message || String(error);
      if (
        msg.includes("503") ||
        msg.includes("429") ||
        msg.includes("high demand")
      ) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw error;
    }
  }
};

// Helper to parse Firestore REST fields into plain JavaScript objects
function parseFirestoreRestFields(fields: any): any {
  if (!fields || typeof fields !== "object") return null;
  const result: any = {};
  for (const [key, value] of Object.entries(fields) as [string, any][]) {
    if (!value || typeof value !== "object") continue;
    if ("stringValue" in value) result[key] = value.stringValue;
    else if ("booleanValue" in value) result[key] = value.booleanValue;
    else if ("integerValue" in value) result[key] = parseInt(value.integerValue, 10);
    else if ("doubleValue" in value) result[key] = parseFloat(value.doubleValue);
    else if ("mapValue" in value) result[key] = parseFirestoreRestFields(value.mapValue?.fields);
    else if ("arrayValue" in value) {
      result[key] = (value.arrayValue?.values || []).map((item: any) =>
        parseFirestoreRestFields({ temp: item })?.temp
      );
    } else if ("nullValue" in value) result[key] = null;
  }
  return result;
}

async function getGlobalGeminiConfigRest(): Promise<any> {
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

const normalizeGeminiModel = (rawModel?: string): string => {
  if (!rawModel || typeof rawModel !== "string") return "gemini-2.5-flash";
  const m = rawModel.trim().toLowerCase();

  if (
    m === "gemini-2.5-flash" ||
    m === "gemini-2.5-flash-lite" ||
    m === "gemini-2.5-pro" ||
    m === "gemini-2.0-flash" ||
    m === "gemini-2.0-flash-lite" ||
    m === "gemini-1.5-flash" ||
    m === "gemini-1.5-pro"
  ) {
    return m;
  }

  if (m.includes("lite") || m.includes("3.5-flash-lite") || m.includes("3.1-flash-lite")) return "gemini-2.5-flash-lite";
  if (m.includes("pro")) return "gemini-2.5-pro";
  if (m.includes("flash") || m.includes("3.6-flash") || m.includes("3.5-flash") || m.includes("3-flash")) return "gemini-2.5-flash";

  return "gemini-2.5-flash";
};

const generateContentStreamWithFallback = async (aiClient: any, payload: any) => {
  const primaryModel = payload.model || "gemini-2.5-flash";
  try {
    return await aiClient.models.generateContentStream(payload);
  } catch (err: any) {
    console.warn(`Primary model ${primaryModel} failed stream (${err?.message}), retrying fallback...`);
    const fallbackModel = primaryModel === "gemini-2.5-flash" ? "gemini-2.5-flash-lite" : "gemini-2.5-flash";
    return await aiClient.models.generateContentStream({
      ...payload,
      model: fallbackModel,
    });
  }
};

const resolveGeminiProxyConfig = async (
  reqBody: any = {},
  reqHeaders: any = {},
  fallbackFeatureKey: string = "general_chat"
) => {
  const featureKey = reqBody.featureKey || reqHeaders["x-feature-key"] || fallbackFeatureKey;
  const clientApiKey = reqBody.customApiKey || reqHeaders["x-custom-api-key"];

  // 1. If client API key attached
  if (clientApiKey && typeof clientApiKey === "string" && clientApiKey.trim().length > 0) {
    const keyToUse = clientApiKey.trim().replace(/^["']|["']$/g, '');
    return {
      apiKey: keyToUse,
      model: normalizeGeminiModel(reqBody.model),
      isGlobalKey: false,
      featureKey,
      aiClient: new GoogleGenAI({ apiKey: keyToUse }),
    };
  }

  // 2. No client key attached: check Firestore system_config/global_gemini
  let globalConfig: any = null;
  try {
    const snap = await getAdminDb().collection("system_config").doc("global_gemini").get();
    if (snap.exists) {
      globalConfig = snap.data();
    }
  } catch (err: any) {
    // If admin SDK failed due to missing service account / ADC permissions, fallback to REST API
    globalConfig = await getGlobalGeminiConfigRest();
    if (!globalConfig) {
      console.warn("Could not retrieve system_config/global_gemini via Admin SDK or REST fallback.");
    }
  }

  const featureSetting = globalConfig?.features?.[featureKey] || {
    enabled: false,
    defaultModel: "gemini-2.5-flash",
  };

  // If feature is disabled and no client key was attached: reject
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

  // Force model = features[featureKey].defaultModel (ignore any user-crafted model parameter in request payload)
  const forcedModel = normalizeGeminiModel(featureSetting.defaultModel);

  return {
    apiKey: globalApiKey.trim(),
    model: forcedModel, // Overridden!
    isGlobalKey: true,
    featureKey,
    aiClient: new GoogleGenAI({ apiKey: globalApiKey.trim() }),
  };
};

const requireAdminAuth = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
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

const formatGeminiError = (error: any) => {
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

// Server-Side Gemini Proxy Route (/api/gemini-proxy)
app.post("/api/gemini-proxy", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];

    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res.status(403).json({
        error: "Forbidden: Invalid token. " + (authErr?.message || ""),
      });
    }

    const { contents, systemInstruction, config: userConfig, featureKey } = req.body;

    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, featureKey || "general_chat");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const mergedConfig: any = {
      ...(userConfig || {}),
    };
    if (systemInstruction) {
      mergedConfig.systemInstruction = systemInstruction;
    }

    const response = await fetchWithRetry(() =>
      proxyRes.aiClient.models.generateContent({
        model: proxyRes.model, // Forced model if global key used
        contents: contents || [],
        config: mergedConfig,
      })
    );

    res.json({
      text: response.text || "",
      modelUsed: proxyRes.model,
      isGlobalKeyUsed: proxyRes.isGlobalKey,
      candidates: response.candidates,
    });
  } catch (error: any) {
    console.error("Gemini Proxy Error:", error);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

// API route for Gemini extraction - Mock Announcement
app.post("/api/extract-mock", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];

    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res.status(403).json({
        error: "Forbidden: Invalid token. " + (authErr?.message || ""),
      });
    }

    const { images } = req.body;
    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "mock_exam_generator");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

    const prompt = `
      Extract the following details from the uploaded banking exam live mock test announcement image(s). 
      There might be multiple images. Combine the information.
      
      - Exam Type (e.g., 'SBI', 'IBPS', 'RRB', etc.)
      - Exam Role (e.g., 'PO', 'Clerk', 'AO', etc.)
      - Exam Phase (e.g., 'Prelims', 'Mains')
      - Exam Scope (e.g., 'Full', 'Sectional', 'Subject-wise')
      - Mock Name (e.g., 'Mock Test 1', 'Live Mock 3', etc.)
      - Platform (e.g. 'PracticeMock', 'Testbook', 'Guidely', 'Oliveboard')
      
      Return as structured JSON. If any field is not visible, infer a reasonable default or an empty string, or do your best to detect it.
    `;

    const contents: any[] = [{ text: prompt }];
    for (const img of images) {
      
          contents.push({
        inlineData: { data: img.base64, mimeType: img.mimeType },
      });
    }

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              examType: { type: Type.STRING },
              examRole: { type: Type.STRING },
              examPhase: { type: Type.STRING },
              examScope: { type: Type.STRING },
              mockName: { type: Type.STRING },
              platform: { type: Type.STRING },
            },
          },
        },
      }),
    );

    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: String(error.message || error) });
  }
});

// API route for Gemini extraction - Scorecard
app.post("/api/extract-scorecard", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];

    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res.status(403).json({
        error: "Forbidden: Invalid token. " + (authErr?.message || ""),
      });
    }

    const { images, subjects } = req.body;
    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "mock_exam_generator");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

    const isDynamic =
      subjects && Array.isArray(subjects) && subjects.length > 0;
    const subjectListStr = isDynamic
      ? subjects.map((s: any) => `- ${s.name} (Key: ${s.id})`).join("\n      ")
      : `
      - Quant (Key: quant)
      - Reasoning (Key: reasoning)
      - English (Key: english)
      - GA (Key: ga)`;

    const prompt = `
      Extract the following details from the uploaded mock test scorecard image(s). 
      There might be multiple images (e.g. one for scores, one for percentiles). Combine the information.
      
      - Exam Type (e.g., 'SBI', 'IBPS', 'RRB', 'SSC', 'CAT', etc.)
      - Exam Role (e.g., 'PO', 'Clerk', 'AO', etc.)
      - Exam Phase (e.g., 'Prelims', 'Mains')
      - Exam Scope (e.g., 'Full', 'Sectional')
      - Mock Name (e.g., 'Mock Test 1', 'Mains Full Test 3', 'Test 1', etc.). IMPORTANT: If it's a Sectional test, DO NOT include the subject name in the mock name. For example, if it says "Numerical Ability Sectional Test 1", return just "Test 1" or "Sectional Test 1" as the mockName.
      - Platform (e.g., 'Testbook', 'PracticeMock', 'Guidely', 'Smartkeeda', 'Oliveboard', 'Adda247'). Look at logos, URLs, or UI style.
      - Date of test (YYYY-MM-DDTHH:mm format if possible)
      - Overall Score (number, extract only the numerator or decimal number! e.g. "16/30" -> 16, "63/100" -> 63)
      - Overall Percentile (number, 0-100)
      - Overall Percentage (number, 0-100)
      - Overall Accuracy (number, 0-100). If not printed but total correct and total attempted are visible, calculate it as (total correct / total attempted) * 100.
      - detectedSubject (If it is a sectional test, identify the subject key from the list below. Else null)
      
      Sectional details containing Score (number, extract only the numerator or decimal number! e.g. "16/30" -> 16, "24.75" -> 24.75), Percentile, and Accuracy (if accuracy is not printed but correct/attempted are visible, calculate it as (correct/attempted)*100) for:
      ${subjectListStr}
      
      Return as structured JSON. If any field is not visible, infer a reasonable default like null or an empty string, or do your best to detect it.
    `;

    const contents: any[] = [{ text: prompt }];
    for (const img of images) {
      
          contents.push({
        inlineData: { data: img.base64, mimeType: img.mimeType },
      });
    }

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: (() => {
            const schemaObj: any = {
              type: Type.OBJECT,
              properties: {
                examType: {
                  type: Type.STRING,
                  description:
                    "Type of banking exam (e.g. SBI, IBPS, RRB, LIC)",
                },
                examRole: {
                  type: Type.STRING,
                  description:
                    "Role of the exam (e.g. PO, Clerk, AO, Assistant)",
                },
                examPhase: {
                  type: Type.STRING,
                  description: "Phase of the exam (e.g. Prelims, Mains)",
                },
                examScope: {
                  type: Type.STRING,
                  description: "Scope of the exam (e.g. Full, Sectional)",
                },
                mockName: {
                  type: Type.STRING,
                  description: "Name of the mock, without subject prefixes",
                },
                platform: {
                  type: Type.STRING,
                  description:
                    "Platform name like Testbook, PracticeMock, etc.",
                },
                detectedSubject: {
                  type: Type.STRING,
                  description:
                    "If sectional, one of the subject keys. Else null",
                },
                date: {
                  type: Type.STRING,
                  description: "Date of the mock in YYYY-MM-DD",
                },
                score: {
                  type: Type.STRING,
                  description: "Extract numerator. E.g. 16/30 -> 16",
                },
                percentile: { type: Type.STRING, description: "E.g. 84.62" },
                percentage: { type: Type.STRING },
                accuracy: { type: Type.STRING, description: "E.g. 72.93" },
              },
            };

            if (isDynamic) {
              subjects.forEach((s: any) => {
                schemaObj.properties[s.id] = {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.STRING },
                    percentile: { type: Type.STRING },
                    accuracy: { type: Type.STRING },
                  },
                };
              });
            } else {
              ["quant", "reasoning", "english", "ga", "computer"].forEach(
                (key) => {
                  schemaObj.properties[key] = {
                    type: Type.OBJECT,
                    properties: {
                      score: { type: Type.STRING },
                      percentile: { type: Type.STRING },
                      accuracy: { type: Type.STRING },
                    },
                  };
                },
              );
            }
            return schemaObj;
          })(),
        },
      }),
    );

    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: String(error.message || error) });
  }
});

// API route for YPT Screenshot OCR Parsing & Point Auto-Calculation
app.post("/api/parse-ypt-screenshot", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }
    const token = authHeader.split("Bearer ")[1];
    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      return res.status(403).json({ error: "Forbidden: Invalid auth token" });
    }

    const { image, rules, knownUsers } = req.body;
    if (!image || !image.base64) {
      return res.status(400).json({ error: "Image base64 is required" });
    }

    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "ypt_screenshot_parser");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

    // Helper functions for handle matching
    const normalizeHandle = (str: string): string => {
      if (!str) return "";
      return str
        .trim()
        .replace(/^@/, "")
        .normalize("NFKC")
        .replace(/[\uFE00-\uFE0F\u200B-\u200D]/g, "")
        .replace(/\s+/g, " ")
        .toLowerCase();
    };

    const extractAlpha = (str: string): string => {
      if (!str) return "";
      return normalizeHandle(str).replace(/[^a-z0-9]/g, "");
    };

    // Build registered users list (combining client knownUsers & Firestore server query)
    const registeredUserList: Array<{ uid: string; yptNames: string[]; displayName?: string }> = [];

    if (Array.isArray(knownUsers)) {
      knownUsers.forEach((u: any) => {
        if (u && u.uid) {
          registeredUserList.push({
            uid: String(u.uid),
            displayName: u.displayName ? String(u.displayName) : undefined,
            yptNames: Array.isArray(u.yptNames) ? u.yptNames.map(String) : [],
          });
        }
      });
    }

    try {
      const usersSnap = await getAdminDb().collection("users").get();
      usersSnap.forEach((doc) => {
        const data = doc.data();
        const names = new Set<string>();
        if (Array.isArray(data.yptNames)) {
          data.yptNames.forEach((n: string) => {
            if (n && typeof n === "string") names.add(n.trim());
          });
        }
        if (typeof data.yptName === "string" && data.yptName.trim()) {
          names.add(data.yptName.trim());
        }
        if (typeof data.displayName === "string" && data.displayName.trim()) {
          names.add(data.displayName.trim());
        }

        const existing = registeredUserList.find((u) => u.uid === doc.id);
        if (existing) {
          names.forEach((n) => {
            if (!existing.yptNames.includes(n)) existing.yptNames.push(n);
          });
        } else {
          registeredUserList.push({
            uid: doc.id,
            displayName: data.displayName,
            yptNames: Array.from(names),
          });
        }
      });
    } catch (e: any) {
      // Fallback to Firestore REST API using request authorization header if admin SDK lacks credentials
      try {
        const projId = firebaseConfig.projectId;
        const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
        const apiKey = firebaseConfig.apiKey;
        const url = `https://firestore.googleapis.com/v1/projects/${projId}/databases/${dbId}/documents/users?key=${apiKey}`;
        const headers: Record<string, string> = {};
        if (req.headers.authorization) {
          headers["Authorization"] = req.headers.authorization;
        }
        const restRes = await fetch(url, { headers });
        if (restRes.ok) {
          const restData = await restRes.json();
          if (Array.isArray(restData.documents)) {
            restData.documents.forEach((doc: any) => {
              const docId = doc.name ? doc.name.split("/").pop() : "";
              const names = new Set<string>();
              const yptNamesVal = doc.fields?.yptNames?.arrayValue?.values;
              if (Array.isArray(yptNamesVal)) {
                yptNamesVal.forEach((v: any) => {
                  if (v?.stringValue) names.add(v.stringValue.trim());
                });
              }
              const dispVal = doc.fields?.displayName?.stringValue;
              if (dispVal) names.add(dispVal.trim());

              if (docId) {
                const existing = registeredUserList.find((u) => u.uid === docId);
                if (existing) {
                  names.forEach((n) => {
                    if (!existing.yptNames.includes(n)) existing.yptNames.push(n);
                  });
                } else {
                  registeredUserList.push({
                    uid: docId,
                    displayName: dispVal,
                    yptNames: Array.from(names),
                  });
                }
              }
            });
          }
        } else {
          console.warn("Firestore REST API fallback for user YPT names returned status:", restRes.status);
        }
      } catch (restErr: any) {
        console.warn("Failed to fetch user YPT names map via REST fallback:", restErr.message);
      }
    }

    const matchYptHandleToUid = (handle: string): string | undefined => {
      if (!handle || registeredUserList.length === 0) return undefined;

      const rawTarget = handle.trim().toLowerCase();
      const cleanTarget = normalizeHandle(handle);
      const alphaTarget = extractAlpha(handle);

      // Pass 1: Raw case-insensitive exact match
      for (const user of registeredUserList) {
        const allNames = [...(user.yptNames || [])];
        if (user.displayName) allNames.push(user.displayName);
        for (const name of allNames) {
          if (name && name.trim().toLowerCase() === rawTarget) return user.uid;
        }
      }

      // Pass 2: Clean normalized match
      for (const user of registeredUserList) {
        const allNames = [...(user.yptNames || [])];
        if (user.displayName) allNames.push(user.displayName);
        for (const name of allNames) {
          if (name && normalizeHandle(name) === cleanTarget) return user.uid;
        }
      }

      // Pass 3: Alphanumeric base match
      if (alphaTarget.length >= 2) {
        for (const user of registeredUserList) {
          const allNames = [...(user.yptNames || [])];
          if (user.displayName) allNames.push(user.displayName);
          for (const name of allNames) {
            if (name) {
              const nameAlpha = extractAlpha(name);
              if (nameAlpha.length >= 2 && nameAlpha === alphaTarget) return user.uid;
            }
          }
        }
      }

      // Pass 4: Substring match
      if (alphaTarget.length >= 3) {
        for (const user of registeredUserList) {
          const allNames = [...(user.yptNames || [])];
          if (user.displayName) allNames.push(user.displayName);
          for (const name of allNames) {
            if (name) {
              const nameAlpha = extractAlpha(name);
              if (nameAlpha.length >= 3 && (alphaTarget.includes(nameAlpha) || nameAlpha.includes(alphaTarget))) {
                return user.uid;
              }
            }
          }
        }
      }

      return undefined;
    };


    const ruleConfig = rules || {
      pointsPerStudyHour: 2,
      morningSnapBonus: 5,
      noStudyPenaltyThresholdHours: 3,
      penaltyPoints: 5,
    };

    let customRuleDesc = "";
    if (Array.isArray(ruleConfig.customRules) && ruleConfig.customRules.length > 0) {
      const ruleLines = ruleConfig.customRules
        .map((cr: any) => `- ${cr.emoji || '✨'} = ${cr.name} (${cr.type === 'bonus' ? '+' : '-'}${cr.points} pts)`)
        .join("\n");
      customRuleDesc = `\nMatching challenge rules to look for under/near each user's study timer/name:\n${ruleLines}\n`;
    }

    const prompt = `
      Analyze the uploaded YPT (Yeolpumta) study group app screenshot.
      YPT screenshots display group members, their daily study times (e.g. "05:30:00", "07:12:19", "1h 45m"), and challenge badge emojis displayed in a horizontal row right below or next to each member's study timer/name (e.g. ☀️, 🌻, 📱, 🔟, 🔥, 🎯, ⏰, 🏆, ⚡).

      Check the area below each user's study timer for challenge badge emojis. ${customRuleDesc}

      Extract each visible member row into a JSON array:
      - "yptHandle": Clean text of member handle/username (e.g. "VENOM ☣️", "The nun 👻", "Sub Lt Vedu🇮🇳").
      - "studyTimeFormatted": Raw formatted study time string shown (e.g. "07:12:19").
      - "hoursStudied": Numerical study duration in decimal hours (e.g. "07:12:19" = 7.21, "05:30:00" = 5.5, "00:00:00" = 0).
      - "morningSnap": Boolean (true if ☀️ morning snap / camera icon / checked status or ☀️ emoji is visible, false otherwise).
      - "detectedEmojis": Array of badge emoji characters detected under or beside the member's timer/name (e.g. ["☀️", "🌻", "📱"]).

      Return structured JSON conforming to the schema.
    `;

    const contents = [
      { text: prompt },
      { inlineData: { data: image.base64, mimeType: image.mimeType || "image/png" } },
    ];

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              members: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    yptHandle: { type: Type.STRING },
                    studyTimeFormatted: { type: Type.STRING },
                    hoursStudied: { type: Type.NUMBER },
                    morningSnap: { type: Type.BOOLEAN },
                    detectedEmojis: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ["yptHandle", "hoursStudied", "morningSnap"],
                },
              },
            },
            required: ["members"],
          },
        },
      })
    );

    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    const rawMembers = Array.isArray(parsed.members) ? parsed.members : [];

    // Calculate points & match user IDs
    const extractedMembers = rawMembers.map((m: any) => {
      const handle = String(m.yptHandle || "").trim();
      const hours = typeof m.hoursStudied === "number" ? Math.max(0, m.hoursStudied) : 0;
      const snap = Boolean(m.morningSnap);
      const detectedEmojis: string[] = Array.isArray(m.detectedEmojis) ? m.detectedEmojis : [];

      // Match against registered user YPT handles
      const matchedUid = matchYptHandleToUid(handle);

      // Points calculation based on rules
      let intervalInHours = 1;
      if (ruleConfig.studyIntervalValue && ruleConfig.studyIntervalValue > 0) {
        intervalInHours = ruleConfig.studyIntervalUnit === 'minutes'
          ? ruleConfig.studyIntervalValue / 60
          : ruleConfig.studyIntervalValue;
      }
      const intervalsCompleted = intervalInHours > 0 ? Math.floor(hours / intervalInHours) : Math.floor(hours);
      const ptsPerInt = typeof ruleConfig.pointsPerInterval === 'number'
        ? ruleConfig.pointsPerInterval
        : (ruleConfig.pointsPerStudyHour || 0);
      let studyPoints = intervalsCompleted * ptsPerInt;

      let penaltyThresholdInHours = ruleConfig.noStudyPenaltyThresholdHours || 0;
      if (ruleConfig.penaltyThresholdValue && ruleConfig.penaltyThresholdValue > 0) {
        penaltyThresholdInHours = ruleConfig.penaltyThresholdUnit === 'minutes'
          ? ruleConfig.penaltyThresholdValue / 60
          : ruleConfig.penaltyThresholdValue;
      }
      let penalty = 0;
      if (penaltyThresholdInHours > 0 && hours < penaltyThresholdInHours) {
        penalty = ruleConfig.penaltyPoints || 0;
      }

      let customPoints = 0;
      const detectedRules: Array<{ ruleId?: string; ruleName: string; emoji: string; points: number }> = [];

      if (Array.isArray(ruleConfig.customRules)) {
        for (const cr of ruleConfig.customRules) {
          if (!cr || !cr.name) continue;
          const nameLower = String(cr.name).toLowerCase();
          const crEmoji = cr.emoji ? String(cr.emoji).trim() : '';
          const p = Number(cr.points) || 0;

          let ruleMatched = false;

          // Match by emoji or morning snap flag
          if (crEmoji && detectedEmojis.some(e => e.includes(crEmoji) || crEmoji.includes(e))) {
            ruleMatched = true;
          } else if (snap && (nameLower.includes('snap') || crEmoji === '☀️')) {
            ruleMatched = true;
          }

          if (ruleMatched) {
            if (cr.type === 'bonus') {
              customPoints += p;
            } else if (cr.type === 'penalty') {
              customPoints -= p;
            }

            detectedRules.push({
              ruleId: cr.id,
              ruleName: cr.name,
              emoji: cr.emoji || '✨',
              points: cr.type === 'bonus' ? p : -p,
            });
          }
        }
      }

      const pointsEarned = studyPoints - penalty + customPoints;

      return {
        yptHandle: handle,
        matchedUid: matchedUid || null,
        hoursStudied: Number(hours.toFixed(2)),
        morningSnap: snap,
        detectedEmojis: detectedEmojis,
        detectedRules: detectedRules,
        pointsEarned: pointsEarned,
      };
    });

    res.json({
      success: true,
      extractedMembers,
      totalMembersFound: extractedMembers.length,
    });
  } catch (error: any) {
    console.error("YPT OCR Gemini Error:", error);
    res.status(500).json({ error: String(error.message || error) });
  }
});

// YPT API Session Token Cache
let yptTokenCache: {
  token: string;
  coid: string;
  expiresAt: number;
} | null = null;

async function getYptAuthToken(req?: any) {
  const reqEmail = req?.headers?.["x-ypt-email"] || req?.query?.yptEmail || req?.body?.yptEmail;
  const reqPassword = req?.headers?.["x-ypt-password"] || req?.query?.yptPassword || req?.body?.yptPassword;
  const rawDirectToken = req?.headers?.["x-ypt-token"] || req?.query?.yptToken || req?.body?.yptToken || process.env.YPT_TOKEN;

  const directToken = rawDirectToken ? String(rawDirectToken).trim() : "";
  if (directToken && directToken !== "null" && directToken !== "undefined" && directToken.length > 10) {
    let coid = (req?.headers?.["x-ypt-coid"] as string) || "";
    if (!coid || coid === "0") {
      try {
        const infoRes = await fetch("https://pi.tgclab.com/user/v2/reload/info", {
          method: "POST",
          headers: {
            authorization: `JWT ${directToken}`,
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
            coid = String(infoData.coid || infoData.country_id);
          }
        }
      } catch (_e) {}
    }
    return {
      token: directToken,
      coid: coid || "8",
      expiresAt: Date.now() + 3600 * 1000,
    };
  }

  const email = (reqEmail || process.env.YPT_EMAIL || "").trim();
  const password = reqPassword || process.env.YPT_PASSWORD || "";

  if (!email || !password || email === "bot@example.com" || password === "YOUR_YPT_PASSWORD" || !email.includes("@")) {
    return null;
  }

  const now = Date.now();
  if (yptTokenCache && yptTokenCache.expiresAt > now + 5 * 60 * 1000 && !reqEmail) {
    return yptTokenCache;
  }

  // YPT auth accepts password or password hashes (MD5, SHA256)
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
          "Accept": "application/json",
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

      const data = await loginRes.json();
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

        const result = {
          token,
          coid: String(coid || "8"),
          expiresAt: now + 50 * 60 * 1000,
        };

        if (!reqEmail) {
          yptTokenCache = result;
        }

        return result;
      }
    } catch (_err) {
      // Continue trying next password variant
    }
  }

  return null;
}

const DEMO_YPT_GROUPS = [
  { id: 331805, t: "🍇 SBI PO & UPSC Sprint 2026", mc: 8, on: "Aarav Sharma" },
  { id: 331806, t: "⚡ Tech & Code Study Guild", mc: 6, on: "Priya Patel" },
];

const DEMO_YPT_ROSTER = [
  { ud: 1001, n: "Aarav_SBI", dl: { sm: 23400000 } }, // 6.5 hrs
  { ud: 1002, n: "Priya_Code", dl: { sm: 38700000 } }, // 10.75 hrs
  { ud: 1003, n: "Rohan_UPSC", dl: { sm: 19800000 } }, // 5.5 hrs
  { ud: 1004, n: "Ananya_R", dl: { sm: 7200000 } },   // 2.0 hrs (under threshold)
  { ud: 1005, n: "Vikram_K", dl: { sm: 32400000 } },  // 9.0 hrs
  { ud: 1006, n: "Neha_Dev", dl: { sm: 14400000 } },  // 4.0 hrs
  { ud: 1007, n: "Karan_S", dl: { sm: 28800000 } },   // 8.0 hrs
  { ud: 1008, n: "Sneha_M", dl: { sm: 41400000 } },   // 11.5 hrs
];

// Server Proxy Endpoint for YPT Live Synchronization (/api/ypt/live-sync)
app.all("/api/ypt/live-sync", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ") && authHeader !== "Bearer undefined" && authHeader !== "Bearer null" && authHeader.length > 15) {
      const token = authHeader.split("Bearer ")[1];
      try {
        await admin.auth().verifyIdToken(token);
      } catch (_authErr: any) {
        // Continue silently if Firebase verification fails (e.g. guest or local dev mode)
      }
    }

    const action = (req.query.action || req.body?.action || "get-groups") as string;
    const groupIdsParam = req.query.groupIds || req.body?.groupIds;

    let yptJwt = "";
    let coid = "IN";
    let isDemoMode = false;

    const hasExplicitCreds = Boolean(
      req.headers["x-ypt-email"] || req.headers["x-ypt-password"] || req.headers["x-ypt-token"] ||
      req.query?.yptEmail || req.body?.yptEmail || req.query?.yptToken || req.body?.yptToken
    );

    const authData = await getYptAuthToken(req);
    if (authData) {
      yptJwt = authData.token;
      coid = authData.coid;
    } else if (hasExplicitCreds) {
      return res.status(400).json({
        success: false,
        error: "YPT Auth Failed (Code 112): Invalid email/password or account uses Google/Apple sign-in on YPT app. Paste your YPT JWT Access Token or add your YPT Group ID manually below.",
        isDemo: false,
      });
    } else {
      isDemoMode = true;
    }

    if (isDemoMode) {
      if (action === "get-groups") {
        return res.json({
          success: true,
          groups: DEMO_YPT_GROUPS,
          isDemo: true,
          message: "Loaded demo YPT groups (YPT credentials unconfigured or server unavailable)",
        });
      }

      if (action === "get-day-log" || action === "get-day-logs") {
        const dateParam = (req.query.date || req.body?.date || "") as string;
        const datesParam = (req.query.dates || req.body?.dates) as string | string[];
        const dateList = datesParam
          ? (Array.isArray(datesParam) ? datesParam : String(datesParam).split(","))
          : (dateParam ? [dateParam] : []);

        const demoHours = 6.25;
        const demoMs = demoHours * 3600000;
        const results = dateList.map((d) => ({
          date: d.trim(),
          totalMs: demoMs,
          studyHours: demoHours,
          subjects: [
            { id: 1, name: "Quantitative Aptitude", sm: 9000000, color: "#3B82F6" },
            { id: 2, name: "Reasoning", sm: 7200000, color: "#10B981" },
            { id: 3, name: "English", sm: 6300000, color: "#8B5CF6" },
          ],
        }));

        if (action === "get-day-logs" || dateList.length > 1) {
          return res.json({ success: true, dayLogs: results, isDemo: true });
        }

        return res.json({
          success: true,
          date: dateParam || results[0]?.date || "today",
          totalMs: demoMs,
          studyHours: demoHours,
          subjects: results[0]?.subjects || [],
          isDemo: true,
          message: "Loaded demo YPT day log (YPT credentials unconfigured or server unavailable)",
        });
      }

      if (action === "get-roster" || action === "get-live-times") {
        return res.json({
          success: true,
          roster: DEMO_YPT_ROSTER,
          members: DEMO_YPT_ROSTER,
          groups: DEMO_YPT_GROUPS,
          nativeChallenges: [
            { id: 331805, title: "🍇 test 3 (ID 331805)" }
          ],
          isDemo: true,
          message: "Loaded demo YPT roster (YPT credentials unconfigured or server unavailable)",
        });
      }
    }

    const yptHeaders = {
      authorization: `JWT ${yptJwt}`,
      "User-Agent": "Dart/3.11 (dart:io)",
      "Content-Type": "application/json",
      coid: coid,
    };

    if (action === "get-groups") {
      const gRes = await fetch("https://pi.tgclab.com/group/groups/v2", {
        headers: yptHeaders,
      });

      if (!gRes.ok) {
        const rawText = await gRes.text();
        const cleanText = rawText.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().substring(0, 150);
        return res.status(gRes.status).json({ error: `YPT Groups API Error (${gRes.status}): ${cleanText || "Server Error"}` });
      }

      const gData = await gRes.json();
      const rawGroups: any[] = [];
      if (Array.isArray(gData.gs)) rawGroups.push(...gData.gs);
      if (Array.isArray(gData.ms)) rawGroups.push(...gData.ms);
      if (Array.isArray(gData.cs)) rawGroups.push(...gData.cs);
      if (Array.isArray(gData.ps)) rawGroups.push(...gData.ps);
      if (rawGroups.length === 0 && Array.isArray(gData)) rawGroups.push(...gData);

      const map = new Map();
      for (const g of rawGroups) {
        if (g && g.id && !map.has(g.id)) map.set(g.id, g);
      }

      const groups = Array.from(map.values()).map((g: any) => ({
        id: g.id || g.gid,
        t: g.t || g.title || g.name || `Group ${g.id}`,
        jc: g.jc !== undefined ? Number(g.jc) : (g.mc ? Number(g.mc) : 0),
        mc: g.mc !== undefined ? Number(g.mc) : (g.jc ? Number(g.jc) : 0),
        on: g.on || g.ownerNickname,
      }));

      return res.json({
        success: true,
        groups,
        raw: gData,
      });
    }

    if (action === "get-day-log" || action === "get-day-logs") {
      const dateParam = (req.query.date || req.body?.date || "") as string;
      const datesParam = (req.query.dates || req.body?.dates) as string | string[];
      const dateList = datesParam
        ? (Array.isArray(datesParam) ? datesParam : String(datesParam).split(",")).map((d) => String(d).trim()).filter(Boolean)
        : (dateParam ? [dateParam.trim()] : []);

      if (dateList.length === 0) {
        return res.status(400).json({ error: "Missing required parameter 'date' or 'dates' (YYYY-MM-DD)" });
      }

      const fetchSingleDay = async (d: string) => {
        try {
          const logUrl = `https://pi.tgclab.com/logs/day?date=${encodeURIComponent(d)}&countryID=${encodeURIComponent(coid)}`;
          const logRes = await fetch(logUrl, { headers: yptHeaders });
          if (!logRes.ok) {
            const rawText = await logRes.text();
            const cleanText = rawText.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().substring(0, 150);
            return {
              date: d,
              totalMs: 0,
              studyHours: 0,
              subjects: [],
              error: `YPT API Error (${logRes.status}): ${cleanText}`,
            };
          }

          const logData = await logRes.json();
          let totalMs = 0;
          if (typeof logData.sm === "number") totalMs = logData.sm;
          else if (typeof logData.total_sm === "number") totalMs = logData.total_sm;
          else if (typeof logData.totalTime === "number") totalMs = logData.totalTime > 100000 ? logData.totalTime : logData.totalTime * 1000;

          const subjects: any[] = [];
          if (Array.isArray(logData.ss)) {
            let subjectSumMs = 0;
            for (const s of logData.ss) {
              if (s) {
                const sMs = typeof s.sm === "number" ? s.sm : (typeof s.st === "number" ? s.st * 1000 : 0);
                subjectSumMs += sMs;
                subjects.push({
                  id: s.id || s.sid,
                  name: s.n || s.name || s.t || s.title || "Subject",
                  sm: sMs,
                  hours: Math.round((sMs / 3600000) * 100) / 100,
                  color: s.c || s.color,
                });
              }
            }
            if (totalMs === 0 && subjectSumMs > 0) {
              totalMs = subjectSumMs;
            }
          }

          const studyHours = Math.round((totalMs / 3600000) * 100) / 100;
          return {
            date: d,
            totalMs,
            studyHours,
            subjects,
            raw: logData,
          };
        } catch (err: any) {
          return {
            date: d,
            totalMs: 0,
            studyHours: 0,
            subjects: [],
            error: String(err?.message || err),
          };
        }
      };

      const dayLogs = await Promise.all(dateList.map(fetchSingleDay));

      if (action === "get-day-logs" || dateList.length > 1) {
        return res.json({
          success: true,
          dayLogs,
        });
      }

      const single = dayLogs[0];
      return res.json({
        success: true,
        date: single.date,
        totalMs: single.totalMs,
        studyHours: single.studyHours,
        subjects: single.subjects,
        raw: single.raw,
        error: single.error,
      });
    }

    if (action === "get-roster" || action === "get-live-times") {
      let gids: string[] = [];
      if (Array.isArray(groupIdsParam) && groupIdsParam.length > 0) {
        gids = groupIdsParam.map((id: any) => String(id).trim()).filter(Boolean);
      } else if (typeof groupIdsParam === "string" || typeof groupIdsParam === "number") {
        gids = String(groupIdsParam).split(",").map((s) => s.trim()).filter(Boolean);
      }

      if (gids.length === 0) {
        const gRes = await fetch("https://pi.tgclab.com/group/groups/v2", { headers: yptHeaders });
        if (gRes.ok) {
          const gData = await gRes.json();
          let rawGroups: any[] = [];
          if (Array.isArray(gData.gs)) rawGroups.push(...gData.gs);
          if (Array.isArray(gData.ms)) rawGroups.push(...gData.ms);
          if (Array.isArray(gData.cs)) rawGroups.push(...gData.cs);
          if (Array.isArray(gData.ps)) rawGroups.push(...gData.ps);
          gids = rawGroups.map((g: any) => String(g.id)).filter(Boolean);
        }
      }

      if (gids.length === 0) {
        return res.json({ success: true, roster: [], members: [], groups: [], nativeChallenges: [] });
      }

      const allMembers: any[] = [];
      const rawChallenges: any[] = [];

      await Promise.all(
        gids.map(async (gid) => {
          try {
            const mUrl = `https://pi.tgclab.com/logs/group/members/v2?groupID=${encodeURIComponent(gid)}&countryID=${encodeURIComponent(coid)}&isLooking=true&version=810046`;
            const mRes = await fetch(mUrl, { headers: yptHeaders });
            if (mRes.ok) {
              const mData = await mRes.json();
              if (Array.isArray(mData.ms)) {
                allMembers.push(...mData.ms);
                // Extract active challenge objects from all members' cls/cs dictionaries
                for (const m of mData.ms) {
                  if (m && m.cls) {
                    if (Array.isArray(m.cls)) {
                      rawChallenges.push(...m.cls);
                    } else if (typeof m.cls === 'object') {
                      for (const [challengeIdStr, challengeItem] of Object.entries(m.cls)) {
                        const chId = Number(challengeIdStr);
                        if (chId && !isNaN(chId)) {
                          rawChallenges.push({
                            ...(typeof challengeItem === 'object' && challengeItem ? (challengeItem as object) : {}),
                            id: chId,
                          });
                        }
                      }
                    }
                  }
                  if (m && m.cs) {
                    if (Array.isArray(m.cs)) {
                      rawChallenges.push(...m.cs);
                    } else if (typeof m.cs === 'object') {
                      for (const [csIdStr, csItem] of Object.entries(m.cs)) {
                        const csId = Number(csIdStr);
                        if (csId && !isNaN(csId)) {
                          rawChallenges.push({
                            ...(typeof csItem === 'object' && csItem ? (csItem as object) : {}),
                            id: csId,
                          });
                        } else {
                          rawChallenges.push(csItem);
                        }
                      }
                    }
                  }
                }
              }

              // Top level challenge properties in response
              if (Array.isArray(mData.cs)) rawChallenges.push(...mData.cs);
              if (Array.isArray(mData.cls)) rawChallenges.push(...mData.cls);
              if (Array.isArray(mData.chs)) rawChallenges.push(...mData.chs);
              if (Array.isArray(mData.challenges)) rawChallenges.push(...mData.challenges);
              if (mData.group && Array.isArray(mData.group.challenges)) rawChallenges.push(...mData.group.challenges);
              if (mData.group && Array.isArray(mData.group.cs)) rawChallenges.push(...mData.group.cs);
              if (mData.g && Array.isArray(mData.g.cs)) rawChallenges.push(...mData.g.cs);
              if (mData.g && Array.isArray(mData.g.cls)) rawChallenges.push(...mData.g.cls);
            }
          } catch (err) {
            console.warn(`Failed to fetch members for group ${gid}:`, err);
          }

          // Also attempt group challenges endpoint
          try {
            const chUrl = `https://pi.tgclab.com/group/challenges/v2?groupID=${encodeURIComponent(gid)}&countryID=${encodeURIComponent(coid)}&version=810046`;
            const chRes = await fetch(chUrl, { headers: yptHeaders });
            if (chRes.ok) {
              const chData = await chRes.json();
              if (Array.isArray(chData.cs)) rawChallenges.push(...chData.cs);
              if (Array.isArray(chData.cls)) rawChallenges.push(...chData.cls);
              if (Array.isArray(chData.challenges)) rawChallenges.push(...chData.challenges);
              if (Array.isArray(chData.chs)) rawChallenges.push(...chData.chs);
              if (Array.isArray(chData)) rawChallenges.push(...chData);
            }
          } catch (e) {
            // Optional endpoint
          }
        })
      );

      // Deduplicate members by permanent User ID (ud) or Nickname (n)
      const memberMap = new Map();
      for (const m of allMembers) {
        const key = m.ud || m.n;
        if (key && !memberMap.has(key)) {
          memberMap.set(key, m);
        }
      }
      const members = Array.from(memberMap.values());

      // Deduplicate and normalize native challenges by ID
      const challengeMap = new Map<number, { id: number; t: string; title: string; e: string; emoji: string; st: number }>();
      for (const c of rawChallenges) {
        if (!c || typeof c !== 'object') continue;
        const id = Number(c.id || c.cid || c.challengeID || c.challengeId);
        if (!id || isNaN(id)) continue;

        const rawTitle = String(c.t || c.title || c.name || c.subject || c.text || '').trim();
        let title = rawTitle;
        let emoji = String(c.e || c.emoji || c.icon || '').trim();

        if (!emoji && title) {
          const emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83E[\uDD00-\uDDFF])/u;
          const match = title.match(emojiRegex);
          if (match) {
            emoji = match[0];
            title = title.replace(emojiRegex, '').trim();
          }
        }

        const existing = challengeMap.get(id);
        if (!existing) {
          challengeMap.set(id, {
            id,
            t: title || `Mission #${id}`,
            title: title || `Mission #${id}`,
            e: emoji || '📸',
            emoji: emoji || '📸',
            st: c.st !== undefined ? Number(c.st) : 0,
          });
        } else {
          // If existing entry has a fallback placeholder, upgrade it with real title/emoji metadata
          if (title && (existing.title.startsWith('Mission #') || !existing.title)) {
            existing.title = title;
            existing.t = title;
          }
          if (emoji && (existing.emoji === '📸' || !existing.emoji)) {
            existing.emoji = emoji;
            existing.e = emoji;
          }
          if (c.st !== undefined && existing.st === 0) {
            existing.st = Number(c.st);
          }
        }
      }
      const nativeChallenges = Array.from(challengeMap.values());

      return res.json({
        success: true,
        roster: members,
        members,
        nativeChallenges,
      });
    }

    return res.status(400).json({ error: `Unknown action '${action}'` });
  } catch (error: any) {
    console.error("YPT Proxy Error:", error);
    const cleanMsg = String(error.message || error).replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().substring(0, 150);
    res.status(500).json({ error: cleanMsg || "Internal Server Error" });
  }
});

app.post("/api/generate-badge", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];

    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res.status(403).json({
        error: "Forbidden: Invalid token. " + (authErr?.message || ""),
      });
    }

    const { promptText } = req.body;

    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "general_chat");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;

    const actualPrompt = promptText || "random exciting achievement badge";

    // 1. Generate Badge Name using flash model
    const textPrompt = `You are a designer. Create a short name for a badge based on this description: "${actualPrompt}". Max 4-5 words. Return ONLY a JSON object: {"name": "The Name"}`;

    const nameResponse = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: [{ role: "user", parts: [{ text: textPrompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
            },
          },
        },
      }),
    );

    let badgeName = "Achievement Badge";
    try {
      const parsed = JSON.parse(nameResponse.text || "{}");
      if (parsed.name) badgeName = parsed.name;
    } catch (e) {}

    // 2. Generate Image using image model
    const imagePrompt = `A clean, vector-style flat icon badge for an achievement: ${actualPrompt}. Keep it simple, centered, colorful, white background, no text on the image.`;
    const imageResponse = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: imagePrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      }),
    );

    let base64Image = null;
    if (imageResponse.candidates && imageResponse.candidates[0].content.parts) {
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = `data:image/jpeg;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("No image was generated by the model");
    }

    res.json({
      name: badgeName,
      imageBase64: base64Image,
    });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    let errorMessage = String(error.message || error);
    if (
      errorMessage.includes("429") ||
      errorMessage.includes("Quota exceeded")
    ) {
      errorMessage =
        "Image generation requires a billing-enabled API key or your current quota was exceeded. Please open Settings -> Secrets to select/provide a custom API Key.";
    }
    res.status(500).json({ error: errorMessage });
  }
});

// Shared Error Detection Protocol for Grammar & Competitive Exams
const ERROR_DETECTION_PROTOCOL = `
<error_detection_protocol>
When a user asks to find an error, spot the error, check if a sentence is grammatically correct, identify incorrect parts (A/B/C/D), or asks for sentence correction / why a sentence is wrong, you MUST strictly adhere to the following 5-step response format:

<response_format>
1. **🎯 Error Located:**
   - Clearly state the exact incorrect fragment or part (e.g., Part D: "...across most semi-urban and rural region...") and what makes it wrong.
   - If the sentence is completely correct with no grammatical errors, clearly state: "No error found in this sentence." and briefly explain why.

2. **🛠️ How to Fix It:**
   - Provide at least 2 distinct ways to fix the sentence:
     • **Standard / Grammatical Fix:** The direct correction of the erroneous word/phrase. *(Core Principle: If the error can be resolved by adjusting the right side / following element to match the preceding anchor, prefer adjusting the right side).*
     • **Reworded / Alternative Version:** A natural alternative phrasing or rearrangement.

3. **🕵️ Spotting Strategy (Trigger Words):**
   - Give the student a mental shortcut / exam strategy focused strictly on the user's error.
   - Explicitly call out the **Trigger Words / Patterns** to look out for during timed exams.
   - NEGATIVE CONSTRAINT: Do NOT list other vocabulary words from the same broad grammar category. (e.g., If the error is 'cope with', do NOT say 'Many verbs like cope, comprise, and discuss...'). Listing extra words pollutes the context and confuses the student. Focus ONLY on the specific trigger word from the user's sentence.

4. **Grammar Blueprint (JSON Block):**
   - You MUST output the grammar rule blueprint strictly as a valid JSON code block enclosed in \`\`\`json ... \`\`\`.
   - The JSON object MUST have the root key "grammarBlueprint" matching the exact schema below.

<json_schema>
\`\`\`json
{
  "grammarBlueprint": {
    "ruleName": "string (Concise rule name for THIS sentence)",
    "formulas": [
      { "text": "string (Valid formula / rule structure)", "isValid": true },
      { "text": "string (Forbidden trap / invalid structure)", "isValid": false }
    ],
    "examTrap": "string (1-2 short sentences explaining the specific deceptive trick examiners use)",
    "quickSwap": "string (e.g. Change '...rural region' ➔ '...rural regions')",
    "example": {
      "incorrect": "string (A FRESH, CLEAR example sentence DIFFERENT from the user's input sentence, with [error fragment] in brackets)",
      "correct": "string (The same fresh sentence with [corrected fragment] in brackets)"
    }
  }
}
\`\`\`
</json_schema>

CRITICAL MANDATES FOR STEP 4:
- NEVER write markdown text, paragraphs, or ASCII flow arrows instead of JSON.
- The JSON block MUST be strictly valid and parseable by standard JSON.parse().
- Always include at least 1 valid formula ("isValid": true) and 1 invalid trap ("isValid": false).
- Under "example", ALWAYS write a FRESH, NEW, DIFFERENT illustrative sentence (DO NOT repeat or copy the user's input sentence). Use [brackets] enclosing the target words.

<examples>
FEW-SHOT DEMONSTRATION 1 (Quantifier / Determiner Agreement):
User Input: "...yet regulatory oversight remains shockingly lax across most semi-urban and rural region."

1. **🎯 Error Located:** Part D: "...rural region". The word "most" is a plural quantifier and must be followed by a plural countable noun.
2. **🛠️ How to Fix It:** 
   - **Standard / Grammatical Fix:** "...across most semi-urban and rural regions."
   - **Reworded / Alternative Version:** "...across a majority of semi-urban and rural regions."
3. **🕵️ Spotting Strategy (Trigger Words):** 
   - Trigger: Whenever you see the quantifier "most", immediately check if the countable noun following it is plural. (Notice: Do not list other quantifiers like some/all/many here).
4. **Grammar Blueprint (JSON Block):**
\`\`\`json
{
  "grammarBlueprint": {
    "ruleName": "Quantifier-Noun Agreement (\"Most + Plural Countable Noun\")",
    "formulas": [
      { "text": "most + Plural Countable Noun (e.g., most regions)", "isValid": true },
      { "text": "most + Singular Countable Noun (e.g., most region)", "isValid": false }
    ],
    "examTrap": "Long compound modifiers (e.g., 'semi-urban and rural') distract you from verifying that 'most' requires the plural noun 'regions'.",
    "quickSwap": "Change: \"...rural region\" ➔ \"...rural regions\"",
    "example": {
      "incorrect": "Most modern [institution] require strict compliance with regulatory standards.",
      "correct": "Most modern [institutions] require strict compliance with regulatory standards."
    }
  }
}
\`\`\`

5. **⚡ Quick Test (Active Recall):**
   Test your understanding of this rule:
   *(A) Despite the recent / (B) economic downturn, / (C) most local business / (D) have managed to survive. / (E) No error*
   [TEST_KEY: {"correct": "C", "explanation": "Replace 'business' with 'businesses' because the quantifier 'most' requires a plural countable noun.", "correctSentence": "Despite the recent economic downturn, most local businesses have managed to survive."}]

FEW-SHOT DEMONSTRATION 2 (Inverted Conditional):
\`\`\`json
{
  "grammarBlueprint": {
    "ruleName": "Third Conditional (Past Unreal Inversion with \"Had\")",
    "formulas": [
      { "text": "Had + Subject + V3 ... Subject + would / could / might + have + V3", "isValid": true },
      { "text": "Had + Subject + V3 ... will have / would + V1", "isValid": false }
    ],
    "examTrap": "Examiners pair the past unreal inversion ('Had anticipated') with future modal 'will not have' instead of the required past modal 'would not have'.",
    "quickSwap": "Change: \"...will not have disbursed...\" ➔ \"...would not have disbursed...\"",
    "example": {
      "incorrect": "Had the authorities acted promptly, the crisis [will not have caused] such severe damage.",
      "correct": "Had the authorities acted promptly, the crisis [would not have caused] such severe damage."
    }
  }
}
\`\`\`

5. **⚡ Quick Test (Active Recall):**
   Test your understanding of this rule:
   *(A) Had the engineering team / (B) detected the structural flaw earlier, / (C) they will have halted / (D) the construction process immediately. / (E) No error*
   [TEST_KEY: {"correct": "C", "explanation": "Replace 'will have halted' with 'would have halted' to match the past unreal conditional established by 'Had... detected'.", "correctSentence": "Had the engineering team detected the structural flaw earlier, they would have halted the construction process immediately."}]
</examples>

5. **⚡ Quick Test (Active Recall):**
   - Generate exactly ONE new practice sentence to test the student's active recall of the rule you JUST taught.
   - STRICT REQUIREMENT: The test sentence MUST test the exact same trigger word, idiom, or structural mechanic defined in the JSON blueprint above.
   - NEGATIVE CONSTRAINT: Do NOT test a "similar" rule or a different word from the same broad category. (e.g., If the rule is about "cope with" vs "cope up with", the test MUST use "cope with". If the rule is "Hardly... when", the test MUST use "Hardly... when").
   - Format the sentence divided into standard exam parts with (A), (B), (C), (D), and (E) No error, for example:
     *(A) Each of the students / (B) are aware of / (C) the new policy / (D) announced yesterday. / (E) No error*
   - MANDATORY: Always embed the exact answer key, short explanation, and the full corrected sentence in the [TEST_KEY: ...] metadata tag right after the question:
     [TEST_KEY: {"correct": "B", "explanation": "Replace 'are' with 'is' because 'Each' takes a singular verb.", "correctSentence": "Each of the students is aware of the new policy announced yesterday."}]
</response_format>

=== QUICK TEST FOLLOW-UP HANDLING ===
If the user's message is an answer, attempt, or query regarding a previously given '⚡ Quick Test':
- **Do NOT re-print the grammarBlueprint JSON block** because this is a practice drill for the same rule already presented.
- **Direct Answer / Option Selection (e.g. A/B/C/D, No Error, or typed explanation):**
  • Evaluate their answer immediately and concisely without unnecessary conversational filler.
  • If **Correct**: Give a brief validation, explain why it's right in 1 line, and ask if they'd like another hard challenge or to explore another topic.
  • If **Incorrect**: Gently pinpoint where the reasoning failed, reinforce the **Spotting Strategy / Trigger Words**, and show the correct fix.
- **Request for a Hint:** Give a subtle clue pointing to the trigger word / subject-verb agreement without giving away the full answer immediately.
- **Request to Reveal / Explain:** Give the concise 1-2 line direct explanation of where the error lies and the corrected sentence.
- **Request for Another Practice Question:** Output the **⚡ Quick Test:** header followed by the fresh test sentence divided into (A)/(B)/(C)/(D)/(E) and the [TEST_KEY: {"correct": "...", "explanation": "...", "correctSentence": "..."}] metadata tag. Do NOT print any rule box.
</error_detection_protocol>
`;

// API route for Learning AI Tutor Chat
app.post("/api/learning-chat", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];

    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res.status(403).json({
        error: "Forbidden: Invalid token. " + (authErr?.message || ""),
      });
    }

    const { messages, useWebSearch, chatMode, useCustomWebSearch } = req.body;

    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "ai_tutor");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

    let modeInstruction = "";
    if (chatMode === "math") {
      modeInstruction = `
You are an expert Math tutor for competitive exams. Do not give conversational wrappers. Provide a rapid, step-by-step, exam-focused approach to solve the problem. Keep your explanations exceptionally concise and structured. Only provide a deep theoretical explanation if the user explicitly asks for 'full explanation'.
`;
    } else if (chatMode === "english") {
      modeInstruction = `
You are an expert English tutor for competitive exams (Bank PO/Clerk, SSC CGL/CHSL, CAT, GRE, etc.).
Provide brief, rule-based, exam-focused explanations for grammar, vocabulary, idioms, sentence improvement, cloze tests, or comprehension. Keep explanations crisp, structured, and free of conversational fluff.
${ERROR_DETECTION_PROTOCOL}
`;
    } else if (chatMode === "reasoning") {
      modeInstruction = `
You are an expert analytical Reasoning tutor. Follow these STRICT rules: 1. Do NOT immediately declare the final answer to puzzles. Instead, outline a detailed step-by-step approach to solve it. 2. For seating arrangements (circular, linear), always suggest applying the 'Thread Method' to unfold the problem. Include the traditional approach only if requested. 3. If the user provides an attempted answer, you must cross-check their answer against EVERY given condition in the problem. If their answer violates a condition, explicitly state which condition fails. If their answer satisfies ALL conditions, state 'Your arrangement satisfies all conditions and is correct'.
`;
    } else {
      modeInstruction = `
${ERROR_DETECTION_PROTOCOL}
`;
    }

    let systemInstruction = `You are a helpful and encouraging AI Tutor focused on helping the user learn. 
Provide concise, clear, and educational responses. If explaining complex topics, use analogies. ${modeInstruction}
You have access to a custom web search tool. Categorize your search as 'news_and_facts' for current events/data, 'semantic_concept' for abstract topics/blogs, or 'general' for basic queries.

CRITICAL INSTRUCTION FOR NAVIGATION LINKS & FEATURES:
- NEVER append promotional messages, reminders, or recommendations about app features (e.g., "Speed Math", "Learning Hub") at the end of your educational answers.
- DO NOT provide UI navigation links (e.g., Action Items, Dashboard, Mock Tests) if the user is asking a question about a concept, studying, learning a topic, or math/science. 
- ONLY provide explanations of app features and markdown navigation buttons IF AND ONLY IF the user explicitly asks about the app's features, navigation, what the app can do, OR if they send a very generic greeting (like "hi", "hello" without asking a question).
- Available pages and their relative URLs for markdown links:
  - Home: [Go to Home](/home)
  - Dashboard: [View Dashboard](/dashboard)
  - Action Items / Tasks: [Go to Tasks](/tasks)
  - Community: [Explore Community](/community)
  - Learning: [Learning Hub](/learning) (Includes Speed Math practice)
  - Profile: [View Profile](/profile)`;

    const contents = messages.map((m: any) => {
      const parts: any[] = [];
      if (m.attachments && Array.isArray(m.attachments)) {
        m.attachments.forEach((att: any) => {
          parts.push({
            inlineData: {
              data: att.data,
              mimeType: att.mimeType,
            },
          });
          if (att.pages && att.mimeType === "application/pdf") {
            parts.push({
              text: `\n[NOTE FOR AI: Only extract information and answer questions based on pages ${att.pages} of this PDF Document.]\n`,
            });
          }
        });
      }
      parts.push({ text: m.text });
      return {
        role: m.role || "user",
        parts,
      };
    });

    if (useCustomWebSearch) {
      systemInstruction += "\n\nYou have access to a custom web search tool. Categorize your search as 'news_and_facts' for current events/data, 'semantic_concept' for abstract topics/blogs, or 'general' for basic queries.";
    }

    const now = new Date();
    const istDateTime = now.toLocaleString("en-IN", { 
      timeZone: "Asia/Kolkata", 
      dateStyle: "full", 
      timeStyle: "long" 
    });
    systemInstruction += `\n\nImportant Context: The current date and time is ${istDateTime} (Indian Standard Time). Please use this as the absolute reference for words like "today", "tomorrow", or "recent".`;





    const config: any = {
      systemInstruction,
    };
    
    config.tools = [];

    if (useWebSearch) {
      config.tools.push({ googleSearch: {} });
    }
    
    if (useCustomWebSearch) {
      config.tools.push({
        functionDeclarations: [

          {
            name: "custom_web_search",
            description: "Search the web for information",
            parameters: {
              type: "OBJECT",
              properties: {
                query: {
                  type: "STRING",
                  description: "The optimized search query"
                },
                search_type: {
                  type: "STRING",
                  description: "Category of search",
                  enum: ["news_and_facts", "semantic_concept", "general"]
                }
              },
              required: ["query", "search_type"]
            }
          }
        ]
      });
    }
    
    if (config.tools.length === 0) {
      delete config.tools;
    }

    if (useCustomWebSearch) {
      config.tools = config.tools || [];
      config.tools.push({ functionDeclarations: [customWebSearchDeclaration] });

    }

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
        contents: contents,
        config: config,
      }),
    );

    let citations: { uri: string; title: string }[] = [];
    if (response?.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      const chunks = response.candidates[0].groundingMetadata.groundingChunks;
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri && chunk.web?.title) {
          citations.push({
            uri: chunk.web.uri,
            title: chunk.web.title,
          });
        }
      });
    }

    res.json({
      reply: response.text || "Sorry, I couldn't generate a response.",
      citations,
    });
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

// API route for Jarvis Brain Engine Chat (/api/jarvis/chat)
app.post("/api/jarvis/chat", async (req, res) => {
  try {
    const { messages, message, context } = req.body;

    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "jarvis");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

    let screenContextBlock = "";
    if (context) {
      const nav = context.visionContext?.navigation || { currentTab: context.location?.activeTab || "Dashboard", activeSubject: null, activeMockId: null };
      const screen = context.visionContext?.screenData || { title: "Overview", visibleSummary: {}, activeQuestion: null, visibleItems: [] };
      const user = context.visionContext?.userState || { targetExam: context.data?.targetExam || "JEE 2026", totalMocksAttempted: 0, weakSubjects: [], strongSubjects: [] };

      let activeRouteStr = context.location?.activeTab || nav.currentTab || "Dashboard";
      if (nav.activeMockId) activeRouteStr += ` -> ${nav.activeMockId}`;
      else if (nav.activeSubject) activeRouteStr += ` -> ${nav.activeSubject}`;

      const metricsEntries = Object.entries(screen.visibleSummary || {}).filter(([_, v]) => v !== undefined && v !== null);
      const metricsStr = metricsEntries.length > 0
        ? metricsEntries.map(([k, v]) => `  • ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`).join('\n')
        : '  • No specific score metrics on screen';

      let focusedQStr = 'None';
      if (screen.activeQuestion) {
        const q = screen.activeQuestion;
        focusedQStr = `${q.id || 'Question'} (${q.topic || q.subject || 'General'}${q.status ? ` - ${q.status}` : ''})`;
      }

      const weakStr = user.weakSubjects && user.weakSubjects.length > 0 ? user.weakSubjects.join(', ') : 'None identified yet';
      const profileStr = `Target ${user.targetExam || 'Competitive Exam'}${weakStr !== 'None identified yet' ? ` | Weak Area: ${weakStr}` : ''}`;

      const itemsStr = screen.visibleItems && screen.visibleItems.length > 0
        ? `- Visible Items Snapshot:\n${screen.visibleItems.map((item: string) => `  • ${item}`).join('\n')}`
        : '';

      const navigatedFrom = context.location?.navigatedFrom || context.navigatedFrom;

      screenContextBlock = `<CURRENT_USER_SCREEN_CONTEXT>
- Active Page / Route: ${activeRouteStr}
${navigatedFrom ? `- Auto-Navigated: Yes\n- Navigated From: ${navigatedFrom}` : ''}
- Screen Header: "${screen.title || 'Screen Overview'}"
- Visible Metrics on Screen:
${metricsStr}
- Currently Focused Question: ${focusedQStr}
- User Profile: ${profileStr}
${itemsStr ? `${itemsStr}` : ''}
</CURRENT_USER_SCREEN_CONTEXT>`;
    } else {
      screenContextBlock = `<CURRENT_USER_SCREEN_CONTEXT>
- Active Page / Route: Home
- Screen Header: "Home Dashboard"
- Visible Metrics on Screen:
  • General Screen View (No specific test score metric active)
- Currently Focused Question: None
- User Profile: Target Competitive Exam
</CURRENT_USER_SCREEN_CONTEXT>`;
    }

    const systemInstruction = `SYSTEM INSTRUCTION:
You are Jarvis, an intelligent AI study partner for competitive exam preparation.
You have real-time visibility into the user's screen and study progress.

${screenContextBlock}

CRITICAL CONSTRAINTS FOR PAGE SUMMARIES:
- You must base your page summary STRICTLY AND ONLY on what is listed inside <CURRENT_USER_SCREEN_CONTEXT>.
- If auto-navigation has taken place (indicated by "Auto-Navigated: Yes" and "Navigated From" in <CURRENT_USER_SCREEN_CONTEXT>), acknowledge the page navigation naturally at the beginning of your response (e.g., "I've navigated you to the Live Mocks section...").
- NEVER mention or hallucinate mock test scores, percentiles, accuracy percentages, study streak days, or mock test performance history logs when the user is on 'home', 'community', 'profile', 'learning', or 'tasks' pages, unless those exact metrics appear explicitly in 'Visible Metrics on Screen' or 'Visible Items Snapshot' for this prompt.
- On the HOME page (route: home): summarize ONLY the Welcome Greeting, Daily Motivation Quote, and Activity Heatmap Map. Do NOT mention mock test performance, percentile, accuracy, or study streak.
- On the PROFILE page (route: profile): summarize ONLY profile settings (Display Name, Target Exam, Sector, Bio). Do NOT mention mock test performance, percentile, accuracy, study streak, or mock history log.
- Do NOT output placeholder or hallucinated performance metrics. Describe ONLY what is strictly visible in <CURRENT_USER_SCREEN_CONTEXT>.

INSTRUCTIONS & RESPONSE TRACES:
1. Use the screen context above to answer user questions directly without asking them what they are looking at.
2. If the user asks a question about a section or page that required auto-navigation, acknowledge switching to that view and answer based on the newly updated screen context.
3. If the user asks "How did I do on my last mock?", strictly analyze ONLY the data present in the screen context.
   - For full mocks: Report overall score, percentile, and subject breakdowns for sections with scores.
   - For sectional mocks (e.g. Reasoning Sectional Test): Report ONLY on the single active subject score present. NEVER hallucinate scores or topics for N/A or '-' sections (such as Quant, English, or GA) when they are not part of the test.
4. If the user asks "Can you summarize what I am looking at right now?" or "What am I looking at?", summarize the active screen components directly from the screen context items and metrics.
5. Keep responses strictly truthful to the visible screen context, helpful, concise, friendly, and structured.`;

    const chatMessages = messages || (message ? [{ role: "user", text: message }] : []);
    const contents = chatMessages.map((m: any) => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      parts: [{ text: m.text || m.content || "" }]
    }));

    const response = await aiClient.models.generateContent({
      model: modelToUse,
      contents: contents,
      config: {
        systemInstruction
      }
    });

    res.json({
      reply: response.text || "No response generated.",
      text: response.text || "No response generated.",
      screenContextUsed: screenContextBlock
    });
  } catch (error: any) {
    console.error("Jarvis Chat API Error:", error);
    res.status(500).json({ error: error.message || "Failed to process Jarvis query." });
  }
});

// API route for Jarvis Intent Determination (/api/jarvis/intent)
app.post("/api/jarvis/intent", async (req, res) => {
  try {
    const { userInput, context, tools } = req.body;

    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "jarvis");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

    const functionDeclarations = (tools || []).map((action: any) => {
      const properties: Record<string, any> = {};
      const buildParam = (p: string) => {
        if (p === 'options') return { type: 'ARRAY', items: { type: 'STRING' }, description: 'List of options' };
        if (p === 'isMulti') return { type: 'BOOLEAN', description: 'Is multi select' };
        if (p === 'optionIndex') return { type: 'NUMBER', description: 'Option index' };
        return { type: 'STRING', description: `Parameter ${p}` };
      };
      (action.requiredParams || []).forEach((p: string) => { properties[p] = buildParam(p); });
      (action.optionalParams || []).forEach((p: string) => { properties[p] = buildParam(p); });

      return {
        name: action.name,
        description: action.description,
        parameters: {
          type: "OBJECT",
          properties: Object.keys(properties).length > 0 ? properties : undefined,
          required: action.requiredParams && action.requiredParams.length > 0 ? action.requiredParams : undefined
        }
      };
    });

    const activeTab = context?.location?.activeTab || 'Dashboard';
    const systemInstruction = `You are the Jarvis UI Controller for an Exam Prep Application. Current active view: ${activeTab}.

Guidelines:
1. Call function tools ONLY when the user explicitly requests a UI action (e.g., "go to dashboard", "open settings", "change theme to dark", "create task", "start math drill").
2. CRITICAL EXCEPTION: Do NOT call any function tool if the user is asking an informational, analytical, performance evaluation, data inquiry, or screen summary question (e.g., "Who is in the top of the leaderboard?", "Who is rank 1?", "How did I do on my last mock?", "What am I looking at?", "Can you summarize what I am looking at right now?", "How are my scores?", "Summarize my performance", "Explain this section"). For these queries, DO NOT invoke any tool or function call so that Jarvis can answer using the full screen context.`;

    const response = await aiClient.models.generateContent({
      model: modelToUse,
      contents: userInput,
      config: {
        systemInstruction,
        tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
        temperature: 0.1
      }
    });

    const call = response.functionCalls?.[0];
    if (call) {
      return res.json({
        intent: {
          action: call.name,
          parameters: call.args || {}
        }
      });
    }

    res.json({ intent: null });
  } catch (error: any) {
    console.error("Jarvis Intent API Error:", error);
    res.json({ intent: null });
  }
});


// --- Custom Web Search Logic ---
async function fetchTavily(query: string) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("Tavily API Key missing");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, search_depth: "basic" })
  });
  if (!response.ok) throw new Error(`Tavily error: ${response.status}`);
  const data = await response.json();
  return (data.results || []).map((r: any) => ({ title: r.title, content: r.content, url: r.url }));
}

async function fetchExa(query: string) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("Exa API Key missing");
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify({ query, numResults: 3, useAutoprompt: true, contents: { text: true } })
  });
  if (!response.ok) throw new Error(`Exa error: ${response.status}`);
  const data = await response.json();
  return (data.results || []).map((r: any) => ({ title: r.title, content: r.text, url: r.url }));
}

async function fetchTinyfish(query: string) {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) throw new Error("Tinyfish API Key missing");
  const client = new TinyFish({ apiKey });
  const response = await client.search.query({ query });
  return (response.results || []).slice(0, 3).map((r: any) => ({
    title: r.title || "Search Result",
    content: r.snippet || "",
    url: r.url || ""
  }));
}

async function fetchPageWithTinyfish(url: string, signal?: AbortSignal) {
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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const response = await fetch("https://r.jina.ai/" + url, { 
      signal,
      headers
    });
    if (!response.ok) {
      await logSearchAttempt("Jina Fetch", url, "error", `Status: ${response.status}`);
      return null; // Suppress the throw
    }
    const text = await response.text();
    await logSearchAttempt("Jina Fetch", url, "success");
    return text;
  } catch(e: any) {
    await logSearchAttempt("Jina Fetch", url, "error", e.message || String(e));
    return null; // Suppress the throw
  }
}

async function getFullPageContent(url: string): Promise<string | null> {
  const globalController = new AbortController();
  const globalTimeoutId = setTimeout(() => globalController.abort(), 15000); // 15 seconds total
  
  try {
    // Give Tinyfish 7 seconds before falling back
    const tfController = new AbortController();
    const tfTimeoutId = setTimeout(() => tfController.abort(), 7000);
    
    let content = await fetchPageWithTinyfish(url, tfController.signal);
    clearTimeout(tfTimeoutId);
    
    if (!content) {
      // Fallback to Jina if Tinyfish fails or returns null
      content = await fetchPageWithJina(url, globalController.signal);
    }
    
    clearTimeout(globalTimeoutId);
    return content;
  } catch (err: any) {
    clearTimeout(globalTimeoutId);
    return null;
  }
}

async function logSearchAttempt(apiName: string, query: string, status: 'success' | 'error', errorMessage?: string) {
  try {
    const db = getAdminDb();
    await db.collection('search_api_logs').add({
      apiName,
      query,
      status,
      ...(errorMessage ? { errorMessage } : {}),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err: any) {
    const errStr = err ? String(err) + (err.message || "") + (err.details || "") : "";
    if (err.code === 7 || err.code === 5 || errStr.includes("PERMISSION_DENIED") || errStr.includes("NOT_FOUND") || errStr.includes("ADC restrictions")) {
      // Fallback to in-memory logs for preview environments
      inMemorySearchLogs.unshift({
        id: "mem-" + Date.now() + Math.random().toString(36).substring(7),
        apiName,
        query,
        status,
        ...(errorMessage ? { errorMessage } : {}),
        createdAt: new Date().toISOString()
      });
      if (inMemorySearchLogs.length > 100) inMemorySearchLogs.pop();
    } else {
      console.error(`Failed to write search log to Firestore for ${apiName}:`, err);
    }
  }
}

async function performCustomSearch(query: string, searchType: string, customSearchApi: string = 'auto') {
  let results = null;
  
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
    if (customSearchApi === 'tavily') {
      try { results = await tryTavily(); } catch(e) { console.error("Tavily failed (forced):", e); }
    } else if (customSearchApi === 'exa') {
      try { results = await tryExa(); } catch(e) { console.error("Exa failed (forced):", e); }
    } else if (customSearchApi === 'tinyfish') {
      try { results = await tryTinyfish(); } catch(e) { console.error("Tinyfish failed (forced):", e); }
    } else {
      if (searchType === "news_and_facts") {
        try { results = await tryTavily(); } 
        catch (e) { console.error("Tavily failed:", e); try { results = await tryTinyfish(); } catch(e2) { console.error("Tinyfish failed:", e2); results = await tryExa(); } }
      } else if (searchType === "semantic_concept") {
        try { results = await tryExa(); } 
        catch (e) { console.error("Exa failed:", e); try { results = await tryTavily(); } catch(e2) { console.error("Tavily failed:", e2); results = await tryTinyfish(); } }
      } else { // general
        try { results = await tryTinyfish(); } 
        catch (e) { console.error("Tinyfish failed:", e); try { results = await tryTavily(); } catch(e2) { console.error("Tavily failed:", e2); results = await tryExa(); } }
      }
    }
  } catch (finalError) {
    console.error("All search providers failed for query:", query, finalError);
    return { error: "Failed to retrieve search results." };
  }
  
  if (results && results.length > 0) {
    // Fetch full page content for the top 2 sites simultaneously to enrich context
    const topResults = results.slice(0, 2);
    const fullContents = await Promise.all(
      topResults.map(async (r: any) => {
        if (!r.url) return null;
        console.log(`Fetching full content for: ${r.url}`);
        return await getFullPageContent(r.url);
      })
    );

    // Merge the full content back into the results
    topResults.forEach((r: any, idx: number) => {
      const fullText = fullContents[idx];
      if (fullText) {
        // Limit context size to ~15,000 chars per page to avoid hitting LLM token limits quickly
        r.content = `[FULL PAGE EXTRACTED CONTENT]:\n${fullText.slice(0, 15000)}`;
      }
    });
  }

  return { results };
}
// --- End Custom Web Search Logic ---

app.post("/api/tutor-chat-stream", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];

    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res.status(403).json({
        error: "Forbidden: Invalid token. " + (authErr?.message || ""),
      });
    }

    const { messages, useWebSearch, useCustomWebSearch, chatMode, customSearchApi } = req.body;

    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "ai_tutor");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

    let modeInstruction = "";
    if (chatMode === "math") {
      modeInstruction = `
You are an expert Math tutor for competitive exams. Do not give conversational wrappers. Provide a rapid, step-by-step, exam-focused approach to solve the problem. Keep your explanations exceptionally concise and structured. Only provide a deep theoretical explanation if the user explicitly asks for 'full explanation'.
`;
    } else if (chatMode === "english") {
      modeInstruction = `
You are an expert English tutor for competitive exams (Bank PO/Clerk, SSC CGL/CHSL, CAT, GRE, etc.).
Provide brief, rule-based, exam-focused explanations for grammar, vocabulary, idioms, sentence improvement, cloze tests, or comprehension. Keep explanations crisp, structured, and free of conversational fluff.
${ERROR_DETECTION_PROTOCOL}
`;
    } else if (chatMode === "reasoning") {
      modeInstruction = `
You are an expert analytical Reasoning tutor. Follow these STRICT rules: 1. Do NOT immediately declare the final answer to puzzles. Instead, outline a detailed step-by-step approach to solve it. 2. For seating arrangements (circular, linear), always suggest applying the 'Thread Method' to unfold the problem. Include the traditional approach only if requested. 3. If the user provides an attempted answer, you must cross-check their answer against EVERY given condition in the problem. If their answer violates a condition, explicitly state which condition fails. If their answer satisfies ALL conditions, state 'Your arrangement satisfies all conditions and is correct'.
`;
    } else {
      modeInstruction = `
${ERROR_DETECTION_PROTOCOL}
`;
    }

    let systemInstruction = `You are a helpful and encouraging AI Tutor focused on helping the user learn. 
Provide concise, clear, and educational responses. If explaining complex topics, use analogies. ${modeInstruction}

CRITICAL INSTRUCTION FOR NAVIGATION LINKS & FEATURES:
- NEVER append promotional messages, reminders, or recommendations about app features (e.g., "Speed Math", "Learning Hub") at the end of your educational answers.
- DO NOT provide UI navigation links (e.g., Action Items, Dashboard, Mock Tests) if the user is asking a question about a concept, studying, learning a topic, or math/science. 
- ONLY provide explanations of app features and markdown navigation buttons IF AND ONLY IF the user explicitly asks about the app's features, navigation, what the app can do, OR if they send a very generic greeting (like "hi", "hello" without asking a question).
- Available pages and their relative URLs for markdown links:
  - Home: [Go to Home](/home)
  - Dashboard: [View Dashboard](/dashboard)
  - Action Items / Tasks: [Go to Tasks](/tasks)
  - Community: [Explore Community](/community)
  - Learning: [Learning Hub](/learning) (Includes Speed Math practice)
  - Profile: [View Profile](/profile)`;

    const contents = messages.map((m: any) => {
      const parts: any[] = [];
      if (m.attachments && Array.isArray(m.attachments)) {
        m.attachments.forEach((att: any) => {
          parts.push({
            inlineData: {
              data: att.data,
              mimeType: att.mimeType,
            },
          });
          if (att.pages && att.mimeType === "application/pdf") {
            parts.push({
              text: `\n[NOTE FOR AI: Only extract information and answer questions based on pages ${att.pages} of this PDF Document.]\n`,
            });
          }
        });
      }
      parts.push({ text: m.text });
      return {
        role: m.role || "user",
        parts,
      };
    });

    if (useCustomWebSearch) {
      systemInstruction += "\n\nYou have access to a custom web search tool. Categorize your search as 'news_and_facts' for current events/data, 'semantic_concept' for abstract topics/blogs, or 'general' for basic queries.";
    }

    const now = new Date();
    const istDateTime = now.toLocaleString("en-IN", { 
      timeZone: "Asia/Kolkata", 
      dateStyle: "full", 
      timeStyle: "long" 
    });
    systemInstruction += `\n\nImportant Context: The current date and time is ${istDateTime} (Indian Standard Time). Please use this as the absolute reference for words like "today", "tomorrow", or "recent".`;



    const config: any = {
      systemInstruction,
    };
    
    config.tools = [];

    if (useWebSearch) {
      config.tools.push({ googleSearch: {} });
    }
    
    if (useCustomWebSearch) {
      config.tools.push({
        functionDeclarations: [

          {
            name: "custom_web_search",
            description: "Search the web for information",
            parameters: {
              type: "OBJECT",
              properties: {
                query: {
                  type: "STRING",
                  description: "The optimized search query"
                },
                search_type: {
                  type: "STRING",
                  description: "Category of search",
                  enum: ["news_and_facts", "semantic_concept", "general"]
                }
              },
              required: ["query", "search_type"]
            }
          }
        ]
      });
    }
    
    if (config.tools.length === 0) {
      delete config.tools;
    }

    try {
      const responseStream = await generateContentStreamWithFallback(aiClient, {
        model: modelToUse,
        contents: contents,
        config: config,
      });

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      let groundingChunksSet = new Set<string>();
      let citations: { uri: string; title: string }[] = [];
      let isFunctionCall = false;
      let functionCallPart: any = null;

      let fullModelParts: any[] = [];
      for await (const chunk of responseStream) {
        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if (part.functionCall) {
              isFunctionCall = true;
              functionCallPart = part.functionCall;
              fullModelParts = chunk.candidates[0].content.parts;
              break;
            }
          }
        }
        if (isFunctionCall) break;
        
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
        if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
          const metadataChunks =
            chunk.candidates[0].groundingMetadata.groundingChunks;
          metadataChunks.forEach((metaChunk: any) => {
            if (metaChunk.web?.uri && metaChunk.web?.title) {
              const key = metaChunk.web.uri;
              if (!groundingChunksSet.has(key)) {
                groundingChunksSet.add(key);
                citations.push({
                  uri: metaChunk.web.uri,
                  title: metaChunk.web.title,
                });
              }
            }
          });
        }
      }
      
      if (isFunctionCall && functionCallPart) {
        if (functionCallPart.name === "custom_web_search") {
          const { query, search_type } = functionCallPart.args as any;
          
          res.write(`data: ${JSON.stringify({ text: "\n*(Searching the web for: " + query + ")*\n" })}\n\n`);
          
          const searchResults = await performCustomSearch(query, search_type, customSearchApi);
          
          if (searchResults.results) {
             searchResults.results.forEach((r: any) => {
               citations.push({ uri: r.url, title: r.title });
             });
          }
          
          contents.push({
            role: "model",
            parts: fullModelParts
          });
          
          contents.push({
            role: "user",
            parts: [{
              functionResponse: {
                name: "custom_web_search",
                response: searchResults,
                id: functionCallPart.id
              }
            }]
          });

          const followUpStream = await generateContentStreamWithFallback(aiClient, {
            model: modelToUse || "gemini-2.5-flash-lite",
            contents: contents,
            config: config,
          });

          for await (const nextChunk of followUpStream) {
             if (nextChunk.text) {
               res.write(`data: ${JSON.stringify({ text: nextChunk.text })}\n\n`);
             }
          }
        }
      }

      if (citations.length > 0) {
        res.write(`data: ${JSON.stringify({ citations })}\n\n`);
      }
      res.end();
    } catch (genError: any) {
      console.error("Gemini API Error in Tutor:", genError);
      const errMsg = genError.message || String(genError);
      if (!res.headersSent) {
        if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
          return res.status(429).json({ error: errMsg });
        }
        if (errMsg.includes("404") || errMsg.includes("NOT_FOUND")) {
          return res.status(404).json({ error: errMsg });
        }
        return res.status(500).json({ error: formatGeminiError(genError) });
      } else {
        res.write(
          `data: ${JSON.stringify({ error: errMsg })}\n\n`,
        );
        res.end();
      }
    }
  } catch (error: any) {
    console.error("Gemini Chat Stream Error:", error);
    if (!res.headersSent) {
      const errMsg = error.message || String(error);
      if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        return res.status(429).json({ error: errMsg });
      }
      if (errMsg.includes("404") || errMsg.includes("NOT_FOUND")) {
        return res.status(404).json({ error: errMsg });
      }
      res.status(500).json({ error: formatGeminiError(error) });
    }
  }
});

app.post("/api/generate-word-details", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token);

    const { word } = req.body;
    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "flashcards");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

    const prompt = `Provide the English meaning and a helpful mnemonic (trick to remember) for the word "${word}". Return ONLY a JSON object: {"meaning": "...", "mnemonic": "..."}`;

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              meaning: { type: Type.STRING },
              mnemonic: { type: Type.STRING },
            },
          },
        },
      }),
    );

    // Safely extract JSON in case the LLM wrapped it in markdown
    const responseText = response.text || "{}";
    const cleanText = responseText
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();
    const match = cleanText.match(/\{[\s\S]*\}/);
    const finalJSON = match ? match[0] : cleanText;
    res.json(JSON.parse(finalJSON));
  } catch (error: any) {
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

app.post("/api/extract-document", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token);

    const { documents, base64Data, mimeType, textData } = req.body;
    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "flashcards");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;
    const prompt = `You are a strict data extraction assistant. Extract vocabulary words, idioms, phrasal verbs, and one-word substitutions from the provided document.

CRITICAL INSTRUCTIONS FOR VOCABULARY:
- Create a SEPARATE object in the array for EACH individual word found in the document. For instance, if the image lists 10 numbered words, the 'vocabulary' array MUST contain exactly 10 separate objects.
- Do NOT clump all words into a single list item.
- For each piece of information, you MUST use the appropriate distinct fields exactly as requested:
  * 'word': Only the vocabulary word itself (e.g. "Alacrity", "Beneath"). Do NOT include the part of speech, meanings, synonyms, antonyms, or examples here. Remove the numbering (e.g. "1", "2").
  * 'pos': The part of speech of the word, if given (e.g. "Noun", "Verb", "Adj", "Adv", "Prep", "Pron"). Extract this from the parentheses next to the word and format it properly (Titlecase).
  * 'meaning': The definition of the word. Include both the Hindi meaning (found in parentheses next to the word) and the English meaning (found below the word).
  * 'synonyms': An array of individual synonym strings (e.g., ["eagerness", "readiness"]).
  * 'antonyms': An array of individual antonym strings (e.g., ["reluctance"]).
  * 'example': A full example sentence using the word. Look for a pen icon or sentence on the right side. Include Hindi translation if present.
  * 'mnemonic': A trick to remember the word, if any is provided.
  * 'additional': When an 'Additional' section is present under a vocabulary word, capture all text (including parenthetical categories, phrases, and idioms) into the word's additional field exactly as formatted. Do NOT extract idioms, one-word substitutions, or phrasal verbs found inside a word's 'Additional' block into the standalone idioms or phrasalVerbs arrays. They belong exclusively to that specific word.

CRITICAL INSTRUCTIONS FOR ONE WORD SUBSTITUTIONS, IDIOMS & PHRASAL VERBS:
- If a section in the document is explicitly titled "One-word substitutes", "One Word Substitutions", "OWS", or similar (even if the title also contains the word "VOCABULARY", like "One-word substitutes: VOCABULARY"), YOU MUST extract ALL items within that section into the 'oneWordSubstitutions' array.
- DO NOT place them in the 'vocabulary' array, even if they are single words!
- For idioms, phrasal verbs, and one-word substitutions, strictly separate 'text' (only the phrase or word itself without the meaning), 'meaning' (the explanation or definition), and 'example' (if an example sentence is provided).
- Format handling: Items often look like "1. Phrase (5) – Meaning spanning multiple lines. Example: Sentence."
- The 'text' MUST ONLY contain the actual phrase/word (e.g. "Knell"). Remove leading numbers (e.g. "1.") and parenthetical numbers (e.g. "(5)").
- The 'meaning' MUST contain the full definition (e.g. "The sound of a bell announcing death or a funeral."). Combine any multi-line text into a single string. Never leave it empty if a definition exists! Do NOT put the definition into the 'text' field of a new object.
- The 'example' MUST contain the example sentence.

Return ONLY structured JSON adhering to this schema. If a field or category is not present, return an empty array or empty string.`;

    const parts: any[] = [{ text: prompt }];

    if (textData) {
      parts[0].text =
        prompt + "\n\n--- SOURCE TEXT TO EXTRACT FROM ---\n" + textData;
    } else if (documents && Array.isArray(documents)) {
      parts.push(
        ...documents.map((doc: any) => ({
          inlineData: { data: doc.base64Data, mimeType: doc.mimeType },
        })),
      );
    } else if (base64Data && mimeType) {
      parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
    }

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vocabulary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    pos: { type: Type.STRING },
                    meaning: { type: Type.STRING },
                    mnemonic: { type: Type.STRING },
                    additional: { type: Type.STRING },
                    synonyms: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    antonyms: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    example: { type: Type.STRING },
                  },
                },
              },
              idioms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: {
                      type: Type.STRING,
                      description:
                        "ONLY the idiom phrase itself. Do NOT include the meaning or hyphen/colon.",
                    },
                    meaning: {
                      type: Type.STRING,
                      description:
                        "The explanation or definition of the phrase.",
                    },
                    example: {
                      type: Type.STRING,
                      description: "An example sentence if available.",
                    },
                  },
                },
              },
              phrasalVerbs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: {
                      type: Type.STRING,
                      description:
                        "ONLY the phrasal verb itself. Do NOT include the meaning.",
                    },
                    meaning: {
                      type: Type.STRING,
                      description:
                        "The explanation or definition of the phrasal verb.",
                    },
                    example: {
                      type: Type.STRING,
                      description: "An example sentence if available.",
                    },
                  },
                },
              },
              oneWordSubstitutions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: {
                      type: Type.STRING,
                      description:
                        "ONLY the one word substitution term. Do NOT include its meaning.",
                    },
                    meaning: {
                      type: Type.STRING,
                      description: "The explanation or definition.",
                    },
                    example: {
                      type: Type.STRING,
                      description: "An example sentence if available.",
                    },
                  },
                },
              },
            },
          },
        },
      }),
    );

    // Safely extract JSON in case the LLM wrapped it in markdown
    const responseText = response.text || "{}";
    const cleanText = responseText
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();
    const match = cleanText.match(/\{[\s\S]*\}/);
    const finalJSON = match ? match[0] : cleanText;
    console.log("Raw LLM text:", responseText);
    console.log("Parsed JSON:", finalJSON);
    res.json(JSON.parse(finalJSON));
  } catch (error: any) {
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

app.post("/api/extract-raw-text", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token);

    const { documents, base64Data, mimeType } = req.body;
    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "flashcards");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;
    const prompt = `You are a verbatim OCR and document transcription engine.
Transcribe and extract ALL visible textual content, editorial analysis, vocabulary words, idioms, sentences, and notes from the attached document/image exactly as written.
Preserve readability, paragraphs, and list structure. Do not summarize or omit anything.`;

    const parts: any[] = [{ text: prompt }];

    if (documents && Array.isArray(documents)) {
      parts.push(
        ...documents.map((doc: any) => ({
          inlineData: { data: doc.base64Data, mimeType: doc.mimeType },
        })),
      );
    } else if (base64Data && mimeType) {
      parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
    } else {
      return res.status(400).json({ error: "No document or image provided for OCR extraction." });
    }

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
        contents: [
          {
            role: "user",
            parts,
          },
        ],
      })
    );

    const rawText = response.text || "";
    res.json({ rawText });
  } catch (error: any) {
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

// Cloudinary API Routes

const requireAdminStorageAuth = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Validate if Cloudinary is configured
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return res
        .status(500)
        .json({ error: "Cloudinary configuration is missing on server" });
    }

    // We require email match for admin
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

app.post(
  "/api/cloudinary/createFolder",
  requireAdminStorageAuth,
  async (req, res) => {
    try {
      const { folderPath } = req.body;
      if (!folderPath)
        return res.status(400).json({ error: "Missing folderPath" });

      const result = await cloudinary.api.create_folder(folderPath);
      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Cloudinary create folder error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to create folder" });
    }
  },
);

app.post(
  "/api/cloudinary/generateSignature",
  requireAdminStorageAuth,
  async (req, res) => {
    try {
      const { paramsToSign } = req.body;
      const timestamp = Math.round(new Date().getTime() / 1000);

      // Mix in timestamp
      const signature = cloudinary.utils.api_sign_request(
        { ...paramsToSign, timestamp },
        process.env.CLOUDINARY_API_SECRET!,
      );

      res.json({
        signature,
        timestamp,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
      });
    } catch (error: any) {
      console.error("Cloudinary generate signature error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to generate signature" });
    }
  },
);

app.post(
  "/api/cloudinary/deleteResource",
  requireAdminStorageAuth,
  async (req, res) => {
    try {
      const decodedToken = (req as any).user;

      const {
        public_id,
        folderPath,
        resourceType,
        cloudResourceType = "image",
      } = req.body; // resourceType: 'file' or 'folder'

      // Security verify: strict owner check
      if (decodedToken.email !== "mrityunjoyk29@gmail.com") {
        return res.status(403).json({
          error: "Forbidden: Only owners can delete resources via API",
        });
      }

      let result;
      if (resourceType === "folder" && folderPath) {
        // First wipe all files inside the folder across all resource types
        try {
          await Promise.all([
            cloudinary.api.delete_resources_by_prefix(folderPath, {
              resource_type: "image",
            }),
            cloudinary.api.delete_resources_by_prefix(folderPath, {
              resource_type: "video",
            }),
            cloudinary.api.delete_resources_by_prefix(folderPath, {
              resource_type: "raw",
            }),
          ]);
        } catch (err) {
          console.warn(
            "Failed to delete some resources by prefix, folder might not be completely empty:",
            err,
          );
        }

        result = await cloudinary.api.delete_folder(folderPath);

        // Simulate webhook locally if Cloudinary fails to trigger it for folder deletes,
        // ensuring our Step 1 cascade still runs.
        try {
          const webhookUrl = `http://127.0.0.1:3000/api/cloudinary/webhook`;
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              notification_type: "delete_folder",
              folder: folderPath,
            }),
          }).catch(() => {});
        } catch (e) {}
      } else if (resourceType === "file" && public_id) {
        const webhookUrl = `https://${req.get("host")}/api/cloudinary/webhook`;
        result = await cloudinary.uploader.destroy(public_id, {
          resource_type: cloudResourceType,
          notification_url: webhookUrl,
        } as any);
        if (result.result !== "ok" && cloudResourceType !== "raw") {
          console.warn(
            `Destroy returned ${result.result} with ${cloudResourceType}, retrying with 'raw'`,
          );
          result = await cloudinary.uploader.destroy(public_id, {
            resource_type: "raw",
            notification_url: webhookUrl,
          } as any);
        }
        if (result.result !== "ok" && cloudResourceType !== "video") {
          console.warn(
            `Destroy returned ${result.result} with 'raw', retrying with 'video'`,
          );
          result = await cloudinary.uploader.destroy(public_id, {
            resource_type: "video",
            notification_url: webhookUrl,
          } as any);
        }
        if (result.result !== "ok" && cloudResourceType !== "image") {
          result = await cloudinary.uploader.destroy(public_id, {
            resource_type: "image",
            notification_url: webhookUrl,
          } as any);
        }
      } else {
        return res
          .status(400)
          .json({ error: "Invalid parameters for deletion" });
      }

      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Cloudinary delete resource error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to delete resource" });
    }
  },
);

app.post("/api/cloudinary/webhook", async (req, res) => {
  try {
    const timestamp = req.headers["x-cld-timestamp"] as string;
    const signature = req.headers["x-cld-signature"] as string;

    if (!timestamp || !signature) {
      return res
        .status(401)
        .json({ error: "Missing Cloudinary signature headers" });
    }

    if (!process.env.CLOUDINARY_API_SECRET) {
      return res
        .status(500)
        .json({ error: "Cloudinary configuration is missing on server" });
    }

    // Verify Signature
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    // Cloudinary SDK method for webhook signature validation
    const isValid = cloudinary.utils.verifyNotificationSignature(
      rawBody,
      Number(timestamp),
      signature,
    );

    if (!isValid) {
      try {
        await writeWebhookLog({
          notificationType: "signature_failed",
          publicId: "failed validation",
          timestamp: null,
          status: "Failed Signature",
          rawPayload: "Signature validation failed",
        });
      } catch (e) {}
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { notification_type, resources } = req.body;

    let publicIds: string[] = [];
    let folderPaths: string[] = [];

    if (resources && Array.isArray(resources) && resources.length > 0) {
      publicIds = resources.map((r: any) => r.public_id).filter(Boolean);
    } else if (req.body.public_ids && Array.isArray(req.body.public_ids)) {
      publicIds = [...req.body.public_ids];
    } else if (req.body.folder) {
      folderPaths = [req.body.folder];
    } else if (req.body.public_id) {
      publicIds = [req.body.public_id];
    }

    const mergedIds = [...publicIds, ...folderPaths];

    // STEP 1: Write to log first. This ensures we have a permanent record even if the sweep below times out or crashes.
    try {
      const statusStr = req.body.status || "success";

      await writeWebhookLog({
        notificationType: notification_type || "unknown",
        publicId: mergedIds.length > 0 ? mergedIds.join(", ") : "",
        publicIds: mergedIds,
        timestamp: null,
        status: statusStr,
        rawPayload: JSON.stringify(req.body),
      });
    } catch (dbError: any) {
      const errStr = dbError ? String(dbError) + (dbError.message || "") + (dbError.details || "") : "";
      if (dbError.code === 7 || dbError.code === 5 || errStr.includes("PERMISSION_DENIED") || errStr.includes("NOT_FOUND") || errStr.includes("ADC restrictions")) {
        // Ignore
      } else {
        console.error("Failed to write to cloudinary_webhook_logs", dbError);
      }
    }

    // STEP 2: Execute the heavy Firestore practice_files sweeps
    if (
      (notification_type === "delete" ||
        notification_type === "delete_folder") &&
      mergedIds.length > 0
    ) {
      console.log("Cloudinary webhook received for deletes:", mergedIds);
      try {
        if (publicIds.length > 0) {
          const chunks = [];
          for (let i = 0; i < publicIds.length; i += 10) {
            chunks.push(publicIds.slice(i, i + 10));
          }

          const chunkPromises = chunks.map(async (chunk) => {
            if (chunk.length === 0) return;
            const snapshot = await getAdminDb()
              .collection("practice_files")
              .where("fileMeta.cloudPublicId", "in", chunk)
              .get();

            if (!snapshot.empty) {
              console.log(
                `Found ${snapshot.docs.length} practice_files matching chunk. Deleting...`,
              );
              const deletePromises = snapshot.docs.map((docSnap) => {
                console.log(`Deleted Firestore doc ${docSnap.id}`);
                return docSnap.ref.delete();
              });
              await Promise.all(deletePromises);
            }
          });

          await Promise.all(chunkPromises);
        }

        if (folderPaths.length > 0) {
          const folderPromises = folderPaths.map(async (folderPath) => {
            if (!folderPath) return;
            const snapshot = await getAdminDb()
              .collection("practice_files")
              .where("fileMeta.cloudPublicId", ">=", folderPath + "/")
              .where("fileMeta.cloudPublicId", "<=", folderPath + "/\uf8ff")
              .get();

            if (!snapshot.empty) {
              console.log(
                `Found ${snapshot.docs.length} practice_files in folder ${folderPath}. Deleting...`,
              );
              const deletePromises = snapshot.docs.map((docSnap) => {
                console.log(`Deleted Firestore doc cascade ${docSnap.id}`);
                return docSnap.ref.delete();
              });
              await Promise.all(deletePromises);
            }
          });

          await Promise.all(folderPromises);
        }
      } catch (err) {
        console.error("Error sweeping practice_files in webhook:", err);
      }
    }

    // We already logged the event before.

    res.json({ success: true });
  } catch (error: any) {
    console.error("Cloudinary webhook error:", error);
  }
});

app.post("/api/webhooks/clear", async (req, res) => {
  try {
    const { logIds } = req.body;
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.json({ success: true, message: "No logs to clear" });
    }

    const adminDb = getAdminDb();

    // Chunk array into max 500 for batch commits
    const chunkArray = (arr: any[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size),
      );

    const chunks = chunkArray(logIds, 500);

    for (const chunk of chunks) {
      const batch = adminDb.batch();
      chunk.forEach((id: string) => {
        batch.delete(adminDb.collection("cloudinary_webhook_logs").doc(id));
      });
      await batch.commit();
    }

    res.json({ success: true, count: logIds.length });
  } catch (error: any) {
    if (error.message && error.message.includes("PERMISSION_DENIED")) {
      // In preview environments without an explicit service account key, ADC might lack permissions.
      // We gracefully instruct the client to use the client-side fallback.
      return res.status(403).json({
        error: "ADC restrictions in preview environment, use client fallback",
      });
    }
    console.error("Failed to clear webhook logs:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to clear webhook logs" });
  }
});

app.get("/api/admin/search-logs", requireAdminAuth, async (req, res) => {
  try {
    const adminDb = getAdminDb();
    const snapshot = await adminDb
      .collection("search_api_logs")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    
    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      // Handle firestore timestamps
      if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        data.createdAt = data.createdAt.toDate().toISOString();
      }
      return { id: doc.id, ...data };
    });
    res.json({ logs });
  } catch (error: any) {
    const errStr = error ? String(error) + (error.message || "") + (error.details || "") : "";
    if (errStr.includes("PERMISSION_DENIED") || errStr.includes("ADC restrictions") || errStr.includes("NOT_FOUND")) {
      return res.status(403).json({
        error: "ADC restrictions in preview environment, use client fallback",
        inMemoryLogs: inMemorySearchLogs
      });
    }
    console.error("Failed to fetch search logs:", error);
    res.status(500).json({ error: error.message || "Failed to fetch search logs" });
  }
});

app.delete("/api/admin/search-logs", requireAdminAuth, async (req, res) => {
  try {
    const adminDb = getAdminDb();
    const snapshot = await adminDb.collection("search_api_logs").get();
    
    const batchSize = 500;
    const chunkArray = (arr: any[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size),
      );
      
    const chunks = chunkArray(snapshot.docs, batchSize);
    for (const chunk of chunks) {
      const batch = adminDb.batch();
      chunk.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    res.json({ success: true, count: snapshot.docs.length });
  } catch (error: any) {
    const errStr = error ? String(error) + (error.message || "") + (error.details || "") : "";
    if (errStr.includes("PERMISSION_DENIED") || errStr.includes("ADC restrictions") || errStr.includes("NOT_FOUND")) {
      inMemorySearchLogs.length = 0; // Clear in-memory logs
      return res.status(403).json({
        error: "ADC restrictions in preview environment, use client fallback",
      });
    }
    console.error("Failed to delete search logs:", error);
    res.status(500).json({ error: error.message || "Failed to delete search logs" });
  }
});

app.post("/api/admin/settings/search-logs", requireAdminAuth, async (req, res) => {
  try {
    const { searchLogAutoDeleteDays } = req.body;
    if (typeof searchLogAutoDeleteDays !== "number") {
      return res.status(400).json({ error: "searchLogAutoDeleteDays must be a number" });
    }
    
    const adminDb = getAdminDb();
    await adminDb.collection("system").doc("settings").set({
      searchLogAutoDeleteDays
    }, { merge: true });
    
    res.json({ success: true });
  } catch (error: any) {
    const errStr = error ? String(error) + (error.message || "") + (error.details || "") : "";
    if (errStr.includes("PERMISSION_DENIED") || errStr.includes("ADC restrictions") || errStr.includes("NOT_FOUND")) {
      return res.status(403).json({
        error: "ADC restrictions in preview environment, use client fallback",
      });
    }
    console.error("Failed to update search logs settings:", error);
    res.status(500).json({ error: error.message || "Failed to update search logs settings" });
  }
});

// YPT Challenge Continuous Auto-Sync Management API
app.get("/api/admin/ypt/sync-cron-status", requireAdminAuth, async (req, res) => {
  try {
    const { getYptSyncCronStatus } = await import("./cron.js");
    const status = getYptSyncCronStatus();
    res.json({ success: true, status });
  } catch (error: any) {
    console.error("Failed to get YPT sync cron status:", error);
    res.status(500).json({ error: error.message || "Failed to get YPT sync status" });
  }
});

app.post("/api/admin/ypt/sync-interval", requireAdminAuth, async (req, res) => {
  try {
    const { intervalMinutes } = req.body;
    const numMinutes = Math.max(1, Math.min(1440, Number(intervalMinutes) || 15));

    const adminDb = getAdminDb();
    await Promise.allSettled([
      adminDb.collection("system").doc("settings").set({
        yptSyncIntervalMinutes: numMinutes
      }, { merge: true }),
      adminDb.collection("yptChallenges").doc("hub_settings").set({
        yptSyncIntervalMinutes: numMinutes
      }, { merge: true })
    ]);

    try {
      const { updateYptSyncCronSchedule } = await import("./cron.js");
      updateYptSyncCronSchedule(adminDb, numMinutes);
    } catch (e: any) {
      console.warn("Notice updating cron schedule:", e.message);
    }

    res.json({ success: true, intervalMinutes: numMinutes });
  } catch (error: any) {
    console.error("Failed to update YPT sync interval:", error);
    res.status(500).json({ error: error.message || "Failed to update YPT sync interval" });
  }
});

app.post("/api/admin/ypt/trigger-continuous-sync", requireAdminAuth, async (req, res) => {
  try {
    const adminDb = getAdminDb();
    const { executeContinuousYptSync } = await import("./cron.js");
    await executeContinuousYptSync(adminDb);
    res.json({ success: true, message: "YPT continuous sync triggered successfully" });
  } catch (error: any) {
    console.error("Failed to trigger YPT continuous sync:", error);
    res.status(500).json({ error: error.message || "Failed to trigger YPT continuous sync" });
  }
});

// Helper for validating incoming cron webhook triggers from cron-job.org or Vercel Crons
function verifyCronTriggerSecret(req: any): boolean {
  const configuredSecret = (process.env.CRON_SECRET || "").trim();
  const defaultFallbackSecret = "ypt_sync_secret_2026";
  
  const authHeader = (req.headers?.authorization || "").trim();
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.substring(7).trim()
    : null;
  const customHeader = (req.headers?.["x-cron-secret"] || "").trim();
  const queryKey = (req.query?.key || req.query?.secret || req.query?.cron_secret || "").toString().trim();
  const bodyKey = (req.body?.key || req.body?.secret || req.body?.cron_secret || "").toString().trim();
  const isVercelCron = Boolean(req.headers?.["x-vercel-cron"]);

  const providedKey = bearerToken || customHeader || queryKey || bodyKey;

  // 1. If Vercel Cron header is present and valid
  if (isVercelCron) {
    return true;
  }

  // 2. If an environment secret is configured
  if (configuredSecret) {
    return (
      providedKey === configuredSecret ||
      providedKey === defaultFallbackSecret
    );
  }

  // 3. If no env secret set, accept default fallback secret or any provided key
  return !providedKey || providedKey === defaultFallbackSecret;
}

// Dedicated endpoints for External Cron Trigger (cron-job.org / GitHub Actions / Vercel Crons)
const handleExternalYptSync = async (req: any, res: any) => {
  if (!verifyCronTriggerSecret(req)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or missing cron secret key.",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const adminDb = getAdminDb();
    const { executeContinuousYptSync } = await import("./cron.js");
    console.log(`[CRON WEBHOOK] Executing YPT continuous sync from ${req.ip || "scheduler"} at ${new Date().toISOString()}...`);
    await executeContinuousYptSync(adminDb);
    
    return res.json({
      success: true,
      message: "YPT continuous sync executed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[CRON WEBHOOK] Failed to execute YPT continuous sync:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to execute YPT continuous sync",
      timestamp: new Date().toISOString(),
    });
  }
};

app.get(["/api/cron/ypt-sync", "/api/cron/ypt_sync"], handleExternalYptSync);
app.post(["/api/cron/ypt-sync", "/api/cron/ypt_sync"], handleExternalYptSync);

// Dedicated endpoint for YPT 5:15 AM IST Daily Finalizer & Transition
const handleExternalYptFinalizer = async (req: any, res: any) => {
  if (!verifyCronTriggerSecret(req)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or missing cron secret key.",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const adminDb = getAdminDb();
    const { execute515AmYptFinalizer } = await import("./cron.js");
    console.log(`[CRON WEBHOOK] Executing YPT 5:15 AM IST Daily Finalizer at ${new Date().toISOString()}...`);
    await execute515AmYptFinalizer(adminDb);
    
    return res.json({
      success: true,
      message: "YPT daily finalizer executed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[CRON WEBHOOK] Failed to execute YPT daily finalizer:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to execute YPT daily finalizer",
      timestamp: new Date().toISOString(),
    });
  }
};

app.get(["/api/cron/ypt-finalizer", "/api/cron/ypt_finalizer"], handleExternalYptFinalizer);
app.post(["/api/cron/ypt-finalizer", "/api/cron/ypt_finalizer"], handleExternalYptFinalizer);


// YouTube Transcript Extraction API via TranscriptAPI
function extractYouTubeVideoId(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  // Direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  // Regex for various YouTube URL patterns
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i
  );
  return match ? match[1] : null;
}

app.post(["/api/youtube/transcript", "/api/youtube-transcript"], async (req, res) => {
  try {
    const rawUrl = req.body?.url || req.body?.videoUrl || req.body?.video_url;
    const startTimeSec = req.body?.startTimeSec;
    const endTimeSec = req.body?.endTimeSec;
    const includeTimestamps = req.body?.includeTimestamps;

    if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
      return res.status(400).json({
        success: false,
        error: "Invalid YouTube URL or video is private/unlisted. Please check the link and try again.",
      });
    }

    const videoId = extractYouTubeVideoId(rawUrl);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: "Invalid YouTube URL or video is private/unlisted. Please provide a valid public YouTube link.",
      });
    }

    const apiKey = process.env.TRANSCRIPT_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "TRANSCRIPT_API_KEY is not configured in environment variables. Please add it to your project settings.",
      });
    }

    // Call TranscriptAPI
    const apiUrl = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(
      videoId
    )}&send_metadata=true`;

    let response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    // Fallback attempt to v1 if v2 returns 404 or path variant
    if (!response.ok && response.status === 404) {
      const fallbackUrl = `https://transcriptapi.com/api/v1/transcript?video_id=${encodeURIComponent(
        videoId
      )}&send_metadata=true`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });
      if (fallbackRes.ok) {
        response = fallbackRes;
      }
    }

    if (!response.ok) {
      const status = response.status;
      let errorData: any = {};
      try {
        const text = await response.text();
        errorData = JSON.parse(text);
      } catch {
        errorData = { error: `HTTP ${status}` };
      }

      const errorMessage =
        errorData?.message ||
        errorData?.error ||
        errorData?.detail ||
        `TranscriptAPI responded with HTTP status ${status}`;

      if (status === 401 || status === 403) {
        return res.status(status).json({
          success: false,
          error: "Invalid or expired TRANSCRIPT_API_KEY. Please verify your API key in project settings.",
          details: errorMessage,
        });
      }

      if (status === 402 || status === 429) {
        return res.status(429).json({
          success: false,
          error: "Transcript API credit limit reached. Check API key in settings or top up credits on TranscriptAPI.",
          details: errorMessage,
        });
      }

      if (status === 404) {
        return res.status(404).json({
          success: false,
          error: "No transcript available for this video. Subtitles or auto-generated captions are not enabled for this video.",
          allowManualInput: true,
          details: errorMessage,
        });
      }

      return res.status(status).json({
        success: false,
        error: `Failed to retrieve video transcript: ${errorMessage}`,
        details: errorData,
      });
    }

    let data: any = {};
    try {
      const rawBody = await response.text();
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      console.warn("Failed to parse TranscriptAPI response JSON:", parseErr);
      data = {};
    }

    // Normalizing transcript segments across possible TranscriptAPI response shapes
    let rawSegments: Array<{ start: number; duration: number; text: string }> = [];
    if (Array.isArray(data?.transcript)) {
      rawSegments = data.transcript;
    } else if (Array.isArray(data?.segments)) {
      rawSegments = data.segments;
    } else if (Array.isArray(data?.data)) {
      rawSegments = data.data;
    } else if (Array.isArray(data)) {
      rawSegments = data;
    }

    const parsedSegments = rawSegments
      .map((seg: any) => ({
        start: typeof seg.start === "number" ? seg.start : parseFloat(seg.start || "0") || 0,
        duration: typeof seg.duration === "number" ? seg.duration : parseFloat(seg.duration || "0") || 0,
        text: (seg.text || "").trim(),
      }))
      .filter((seg) => seg.text.length > 0);

    if (parsedSegments.length === 0 && typeof data?.text === "string" && data.text.trim()) {
      parsedSegments.push({
        start: 0,
        duration: 0,
        text: data.text.trim(),
      });
    }

    if (parsedSegments.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No transcript available for this video. The returned captions were empty.",
        allowManualInput: true,
      });
    }

    const totalDurationSec = Math.max(...parsedSegments.map((s) => s.start + s.duration));

    // Time-range filtering with automatic clamping
    let startSec = typeof startTimeSec === "number" && !isNaN(startTimeSec) && startTimeSec >= 0
      ? startTimeSec
      : 0;
    let endSec = typeof endTimeSec === "number" && !isNaN(endTimeSec) && endTimeSec > 0
      ? endTimeSec
      : totalDurationSec;

    // Automatic clamping logic
    let isClamped = false;
    if (startSec >= totalDurationSec) {
      startSec = 0;
      isClamped = true;
    }
    if (endSec > totalDurationSec) {
      endSec = totalDurationSec;
      isClamped = true;
    }

    const filteredSegments = parsedSegments.filter((seg) => {
      const segStart = seg.start;
      return segStart >= startSec && segStart <= endSec;
    });

    const finalSegments = filteredSegments.length > 0 ? filteredSegments : parsedSegments;

    let fullText = finalSegments
      .map((s) => (includeTimestamps ? `[${Math.floor(s.start / 60)}:${Math.floor(s.start % 60).toString().padStart(2, "0")}] ${s.text}` : s.text))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    // Handling very long videos (> 30,000 words / ~150,000 chars)
    let isTruncated = false;
    const wordCount = fullText.split(/\s+/).length;
    if (wordCount > 30000) {
      const words = fullText.split(/\s+/).slice(0, 30000);
      fullText = words.join(" ") + "... [Transcript truncated at 30,000 words for optimal AI analysis]";
      isTruncated = true;
    }

    const extractedDurationSec = finalSegments.length > 0
      ? Math.max(...finalSegments.map((s) => s.start + s.duration)) - Math.min(...finalSegments.map((s) => s.start))
      : totalDurationSec;

    const videoTitle = data?.metadata?.title || data?.title || `YouTube Video (${videoId})`;
    const channelTitle = data?.metadata?.author || data?.metadata?.channel || data?.author || data?.channelTitle;

    return res.json({
      success: true,
      videoId,
      videoTitle,
      channelTitle,
      totalDurationSec: Math.round(totalDurationSec),
      extractedDurationSec: Math.round(extractedDurationSec),
      clampedStartSec: startSec,
      clampedEndSec: endSec,
      isClamped,
      isTruncated,
      wordCount,
      segmentCount: finalSegments.length,
      fullText,
      segments: finalSegments,
    });
  } catch (error: any) {
    console.error("Error in /api/youtube/transcript:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred while extracting the YouTube transcript.",
    });
  }
});

// Endpoint for extracting structured editorial vocabulary from any source text/transcript using Gemini
app.post("/api/extract-editorial-vocab", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token);

    const { textBody, transcript, customInstructions, context, videoContext, targetLevel, wordCount, nativeLanguage } = req.body;
    const sourceText = (typeof textBody === "string" && textBody.trim()) 
      ? textBody.trim() 
      : (typeof transcript === "string" && transcript.trim()) 
      ? transcript.trim() 
      : "";

    if (!sourceText) {
      return res.status(400).json({ error: "Text content (textBody or transcript) is required for vocabulary extraction." });
    }

    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "flashcards");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

    // Standardized context resolution (supports string context or object context)
    let contextStr = "";
    if (typeof context === "string" && context.trim()) {
      contextStr = `\nSource Context / Metadata: ${context.trim()}`;
    } else if (context && typeof context === "object") {
      contextStr = `\nSource Context: ${JSON.stringify(context)}`;
    } else if (videoContext && typeof videoContext === "object") {
      const titleContext = videoContext.title ? `Title: "${videoContext.title}" ` : "";
      const channelContext = videoContext.channel ? `Channel/Author: "${videoContext.channel}"` : "";
      contextStr = `\nSource Context: ${titleContext}${channelContext}`.trim();
    }

    let systemPrompt = "";
    const isCustomInstruction = Boolean(customInstructions && typeof customInstructions === "string" && customInstructions.trim());

    if (isCustomInstruction) {
      systemPrompt = `${customInstructions.trim()}${contextStr ? `\n\nSOURCE CONTEXT METADATA:\n${contextStr}` : ""}`;
    } else {
      const targetLevelStr = typeof targetLevel === "string" && targetLevel.trim() ? targetLevel.trim() : "B2";
      const wordCountNum = typeof wordCount === "number" && wordCount > 0 ? wordCount : 15;
      const nativeLangStr = typeof nativeLanguage === "string" && nativeLanguage.trim() ? nativeLanguage.trim() : "English";

      systemPrompt = `You are a specialized Vocabulary and Language Extraction Assistant.
Extract core high-value vocabulary words from the provided source content at a ${targetLevelStr} level (${wordCountNum} words).
Provide clear definitions and contextual meanings in English.

Structure every response exactly according to the following layout guide:

#### **Core Vocabularies & Additional Words**

* **[Word] ([Part of Speech in Title Case])**
    * **Meaning:** [Core meaning / definition]
    * **Synonyms:** [Comma-separated synonyms]
    * **Antonyms:** [Comma-separated antonyms]
    * **Additional:**
        ([theme descriptor]): [Comma-separated list of related terms, idioms, or phrasal verbs]
    * **Example:** [Example sentence]`;
    }

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\nTRANSCRIPT / SOURCE CONTENT:\n${sourceText}`,
          },
        ],
      },
    ];

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
        contents,
      })
    );

    const rawOutputText = response.text || "";
    const cleanText = rawOutputText
      .replace(/^```markdown\s*/gi, "")
      .replace(/^```\s*/gi, "")
      .replace(/\s*```$/gi, "")
      .trim();

    // Parse the Markdown into structured words
    const lines = cleanText.split("\n");
    const words: Array<any> = [];
    let headerTitle = "Core Vocabularies & Additional Words";

    let currentWord: any = null;
    let currentField: "meaning" | "synonyms" | "antonyms" | "additional" | "example" | null = null;
    const additionalLines: string[] = [];

    const finalizeWord = () => {
      if (currentWord && currentWord.word) {
        if (additionalLines.length > 0) {
          currentWord.additional = additionalLines.join("\n").trim();
          currentWord.editorialContext = currentWord.additional;
        }
        words.push({
          word: currentWord.word.trim(),
          pos: currentWord.pos?.trim() || "Noun",
          meaning: currentWord.meaning?.trim() || "",
          synonyms: currentWord.synonyms || [],
          antonyms: currentWord.antonyms || [],
          additional: currentWord.additional || "",
          editorialContext: currentWord.editorialContext || "",
          example: currentWord.example?.trim() || "",
          mnemonic: "",
        });
      }
      currentWord = null;
      currentField = null;
      additionalLines.length = 0;
    };

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;

      if (/^#+\s*(\*\*)?Core Vocabularies/i.test(trimmed) || /^Core Vocabularies/i.test(trimmed)) {
        headerTitle = trimmed.replace(/^[#*\s]+|[#*\s]+$/g, "").trim();
        continue;
      }

      // Match Word Header: e.g. "* **Debilitating (Adjective)**" or "**Debilitating (Adjective)**" or "Debilitating (Adjective)"
      const wordHeaderMatch = trimmed.match(
        /^(?:\*|\-)?\s*(?:\*\*)?([A-Za-z\s\-']+?)\s*\(([^)]+)\)(?:\*\*)?\s*$/
      );
      const isFieldStart = /^(?:\*|\-)?\s*(?:\*\*)?(Meaning|Synonyms|Antonyms|Additional|Example):/i.test(trimmed);

      if (wordHeaderMatch && !isFieldStart && !/^\s*\([^)]+\):/.test(trimmed)) {
        finalizeWord();
        currentWord = {
          word: wordHeaderMatch[1].replace(/\*\*/g, "").trim(),
          pos: wordHeaderMatch[2].replace(/\*\*/g, "").trim(),
          synonyms: [],
          antonyms: [],
        };
        continue;
      }

      if (currentWord) {
        const meaningMatch = trimmed.match(/^(?:\*|\-)?\s*(?:\*\*)?Meaning(?:\*\*)?\s*:\s*(.+)$/i);
        if (meaningMatch) {
          currentField = "meaning";
          currentWord.meaning = meaningMatch[1].replace(/^\*\*|\*\*$/g, "").trim();
          continue;
        }

        const synMatch = trimmed.match(/^(?:\*|\-)?\s*(?:\*\*)?Synonyms(?:\*\*)?\s*:\s*(.*)$/i);
        if (synMatch) {
          currentField = "synonyms";
          const synStr = synMatch[1].replace(/^\*\*|\*\*$/g, "").trim();
          currentWord.synonyms = synStr ? synStr.split(",").map((s: string) => s.trim().replace(/^\*\*|\*\*$/g, "")).filter(Boolean) : [];
          continue;
        }

        const antMatch = trimmed.match(/^(?:\*|\-)?\s*(?:\*\*)?Antonyms(?:\*\*)?\s*:\s*(.*)$/i);
        if (antMatch) {
          currentField = "antonyms";
          const antStr = antMatch[1].replace(/^\*\*|\*\*$/g, "").trim();
          currentWord.antonyms = antStr ? antStr.split(",").map((s: string) => s.trim().replace(/^\*\*|\*\*$/g, "")).filter(Boolean) : [];
          continue;
        }

        const addMatch = trimmed.match(/^(?:\*|\-)?\s*(?:\*\*)?Additional(?:\*\*)?\s*:\s*(.*)$/i);
        if (addMatch) {
          currentField = "additional";
          const inlineContent = addMatch[1].replace(/^\*\*|\*\*$/g, "").trim();
          if (inlineContent) additionalLines.push(inlineContent);
          continue;
        }

        const exMatch = trimmed.match(/^(?:\*|\-)?\s*(?:\*\*)?Example(?:\*\*)?\s*:\s*(.+)$/i);
        if (exMatch) {
          currentField = "example";
          currentWord.example = exMatch[1].replace(/^\*\*|\*\*$/g, "").trim();
          continue;
        }

        if (currentField === "additional" || /^\s*\([^)]+\):/.test(trimmed)) {
          additionalLines.push(trimmed);
          continue;
        }

        if (currentField === "meaning" && currentWord.meaning) {
          currentWord.meaning += " " + trimmed;
          continue;
        }

        if (currentField === "example" && currentWord.example) {
          currentWord.example += " " + trimmed;
          continue;
        }
      }
    }

    finalizeWord();

    return res.json({
      title: headerTitle || "Core Vocabularies & Additional Words",
      topic: "English & Editorial Analysis",
      rawMarkdown: cleanText,
      words: words,
      idiomsAndPhrases: [],
    });
  } catch (error: any) {
    console.error("Error in /api/extract-editorial-vocab:", error);
    return res.status(500).json({ error: formatGeminiError(error) });
  }
});

export default app;

