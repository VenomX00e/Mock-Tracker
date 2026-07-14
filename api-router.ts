import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";
import { v2 as cloudinary } from "cloudinary";

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

// Helper to format Gemini err
import { Request, Response, NextFunction } from "express";

const requireAdminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
      errStr.includes("429")
    ) {
      return "This AI model is currently experiencing high demand. Please try again in a few moments.";
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

    const { images, customApiKey } = req.body;
    const aiClient = getAiClient(customApiKey);

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
        model: "gemini-3.1-flash-lite",
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

    const { images, customApiKey, subjects } = req.body;
    const aiClient = getAiClient(customApiKey);

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
        model: "gemini-3.1-flash-lite",
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

    const { promptText, customApiKey } = req.body;
    const aiClient = getAiClient(customApiKey);

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

    const { messages, customApiKey, model, useWebSearch, chatMode, useCustomWebSearch } = req.body;

    if (!customApiKey) {
      return res.status(403).json({
        error:
          "A personal Gemini API key is required to use this feature. Please add your key in the AI Tutor Settings.",
      });
    }

    const aiClient = new GoogleGenAI({ apiKey: customApiKey });

    let modeInstruction = "";
    if (chatMode === "math") {
      modeInstruction = `
You are an expert Math tutor for competitive exams. Do not give conversational wrappers. Provide a rapid, step-by-step, exam-focused approach to solve the problem. Keep your explanations exceptionally concise and structured. Only provide a deep theoretical explanation if the user explicitly asks for 'full explanation'.
`;
    } else if (chatMode === "english") {
      modeInstruction = `
You are an expert English tutor for competitive exams. Provide brief, rule-based explanations for grammar, vocabulary, or comprehension. Keep explanations concise, structured, and exam-focused.
`;
    } else if (chatMode === "reasoning") {
      modeInstruction = `
You are an expert analytical Reasoning tutor. Follow these STRICT rules: 1. Do NOT immediately declare the final answer to puzzles. Instead, outline a detailed step-by-step approach to solve it. 2. For seating arrangements (circular, linear), always suggest applying the 'Thread Method' to unfold the problem. Include the traditional approach only if requested. 3. If the user provides an attempted answer, you must cross-check their answer against EVERY given condition in the problem. If their answer violates a condition, explicitly state which condition fails. If their answer satisfies ALL conditions, state 'Your arrangement satisfies all conditions and is correct'.
`;
    }

    let systemInstruction = `You are a helpful and encouraging AI Tutor focused on helping the user learn. 
Provide concise, clear, and educational responses. If explaining complex topics, use analogies. ${modeInstruction}
You have access to a custom web search tool. Categorize your search as 'news_and_facts' for current events/data, 'semantic_concept' for abstract topics/blogs, or 'general' for basic queries.

CRITICAL INSTRUCTION FOR NAVIGATION LINKS:
- DO NOT provide UI navigation links (e.g., Action Items, Dashboard, Mock Tests) if the user is asking a question about a concept, studying, learning a topic, or math/science. 
- ONLY provide explanations of app features and markdown navigation buttons IF AND ONLY IF the user explicitly asks about the app's features, navigation, what the app can do, OR if they send a very generic greeting (like "hi", "hello" without asking a question).
- When asked if there are math exercises or speed math, ALWAYS mention that there is a "Speed Math" practice feature in the Learning section.
- You can inform the user that they can apply updates directly from the app via the "bell" status icon on the top navigation bar or sidebar.
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
        model: model || "gemini-3.1-flash-lite",
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
  const response = await fetch("https://api.tinyfish.io/v1/search?q=" + encodeURIComponent(query), {
    headers: { "Authorization": `Bearer ${apiKey}` }
  });
  if (!response.ok) throw new Error(`Tinyfish error: ${response.status}`);
  const data = await response.json();
  return (data.results || data.data || []).slice(0, 3).map((r: any) => ({
    title: r.title || "Search Result",
    content: r.content || r.snippet || r.text || "",
    url: r.url || r.link || ""
  }));
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

async function performCustomSearch(query: string, searchType: string) {
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
  } catch (finalError) {
    console.error("All search providers failed for query:", query, finalError);
    return { error: "Failed to retrieve search results." };
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

    const { messages, customApiKey, model, useWebSearch, useCustomWebSearch, chatMode } = req.body;

    if (!customApiKey) {
      return res.status(403).json({
        error:
          "A personal Gemini API key is required to use this feature. Please add your key in the AI Tutor Settings.",
      });
    }

    const aiClient = new GoogleGenAI({ apiKey: customApiKey });

    let modeInstruction = "";
    if (chatMode === "math") {
      modeInstruction = `
You are an expert Math tutor for competitive exams. Do not give conversational wrappers. Provide a rapid, step-by-step, exam-focused approach to solve the problem. Keep your explanations exceptionally concise and structured. Only provide a deep theoretical explanation if the user explicitly asks for 'full explanation'.
`;
    } else if (chatMode === "english") {
      modeInstruction = `
You are an expert English tutor for competitive exams. Provide brief, rule-based explanations for grammar, vocabulary, or comprehension. Keep explanations concise, structured, and exam-focused.
`;
    } else if (chatMode === "reasoning") {
      modeInstruction = `
You are an expert analytical Reasoning tutor. Follow these STRICT rules: 1. Do NOT immediately declare the final answer to puzzles. Instead, outline a detailed step-by-step approach to solve it. 2. For seating arrangements (circular, linear), always suggest applying the 'Thread Method' to unfold the problem. Include the traditional approach only if requested. 3. If the user provides an attempted answer, you must cross-check their answer against EVERY given condition in the problem. If their answer violates a condition, explicitly state which condition fails. If their answer satisfies ALL conditions, state 'Your arrangement satisfies all conditions and is correct'.
`;
    }

    let systemInstruction = `You are a helpful and encouraging AI Tutor focused on helping the user learn. 
Provide concise, clear, and educational responses. If explaining complex topics, use analogies. ${modeInstruction}

CRITICAL INSTRUCTION FOR NAVIGATION LINKS:
- DO NOT provide UI navigation links (e.g., Action Items, Dashboard, Mock Tests) if the user is asking a question about a concept, studying, learning a topic, or math/science. 
- ONLY provide explanations of app features and markdown navigation buttons IF AND ONLY IF the user explicitly asks about the app's features, navigation, what the app can do, OR if they send a very generic greeting (like "hi", "hello" without asking a question).
- When asked if there are math exercises or speed math, ALWAYS mention that there is a "Speed Math" practice feature in the Learning section.
- You can inform the user that they can apply updates directly from the app via the "bell" status icon on the top navigation bar or sidebar.
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

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    try {
      const responseStream = await aiClient.models.generateContentStream({
        model: model || "gemini-3.1-flash-lite",
        contents: contents,
        config: config,
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
          
          const searchResults = await performCustomSearch(query, search_type);
          
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

          const followUpStream = await aiClient.models.generateContentStream({
            model: model || "gemini-3.1-flash-lite",
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
      res.write(
        `data: ${JSON.stringify({ error: formatGeminiError(genError) })}\n\n`,
      );
      res.end();
    }
  } catch (error: any) {
    console.error("Gemini Chat Stream Error:", error);
    if (!res.headersSent) {
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

    const { word, customApiKey, model } = req.body;
    if (!customApiKey)
      return res.status(403).json({ error: "API key required" });

    const aiClient = new GoogleGenAI({ apiKey: customApiKey });
    const prompt = `Provide the English meaning and a helpful mnemonic (trick to remember) for the word "${word}". Return ONLY a JSON object: {"meaning": "...", "mnemonic": "..."}`;

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: model || "gemini-3.1-flash-lite",
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

    const { documents, base64Data, mimeType, customApiKey, model, textData } =
      req.body;
    if (!customApiKey)
      return res.status(403).json({ error: "API key required" });

    const aiClient = new GoogleGenAI({ apiKey: customApiKey });
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

For idioms, phrasal verbs, and one-word substitutions, strictly separate 'text' (only the phrase itself without the meaning), 'meaning' (the explanation or definition of the phrase), and 'example' (if an example sentence is provided).
If the document lists definitions separated by colons or hyphens (e.g. "Phrase: Meaning" or "Phrase - Meaning"), YOU MUST split them appropriately. The 'text' MUST ONLY contain "Phrase" and the 'meaning' MUST ONLY contain "Meaning". Do NOT include the meaning inside the 'text' field.
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
        model: model || "gemini-3.1-flash-lite",
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

// Cloudinary API Routes

import { Request, Response, NextFunction } from "express";

const requireAdminStorageAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

export default app;
