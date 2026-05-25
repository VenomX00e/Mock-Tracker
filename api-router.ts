import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import admin from "firebase-admin";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let firebaseConfig: any = {};
try {
  firebaseConfig = require("./firebase-applet-config.json");
} catch (e: any) {
  console.warn("Could not lazily read firebase config:", e.message);
}

if (!admin.apps.length && firebaseConfig.projectId) {
   admin.initializeApp({ projectId: firebaseConfig.projectId });
}


const app = express();
app.use((req, res, next) => {
  // If Vercel already parsed it into an object that is not a Buffer
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    (req as any)._body = true;
  }
  next();
});
app.use(express.json({ limit: "50mb" }));

// Helper
const getAiClient = (customApiKey?: string) => {
  let keyToUse = customApiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!keyToUse) throw new Error("No Gemini API key available. Please add an API key.");
  return new GoogleGenAI({ apiKey: keyToUse });
};

// Helper to retry Gemini requests
const fetchWithRetry = async (fn: () => Promise<any>, retries = 2, delayMs = 1500) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (i === retries) throw error;
      const msg = error.message || String(error);
      if (msg.includes('503') || msg.includes('429') || msg.includes('high demand')) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw error;
    }
  }
};

// Helper to format Gemini err
const formatGeminiError = (error: any) => {
  try {
    const errStr = error.message || String(error);
    if (errStr.includes("503") || errStr.includes("high demand") || errStr.includes("429")) {
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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split('Bearer ')[1];
    


    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res.status(403).json({ error: "Forbidden: Invalid token. " + (authErr?.message || "") });
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
      contents.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
    }

    const response = await fetchWithRetry(() => aiClient.models.generateContent({
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
            platform: { type: Type.STRING }
          }
        }
      }
    }));

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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split('Bearer ')[1];
    


    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res.status(403).json({ error: "Forbidden: Invalid token. " + (authErr?.message || "") });
    }

    const { images, customApiKey, subjects } = req.body;
    const aiClient = getAiClient(customApiKey);
    
    const isDynamic = subjects && Array.isArray(subjects) && subjects.length > 0;
    const subjectListStr = isDynamic 
      ? subjects.map((s: any) => `- ${s.name} (Key: ${s.id})`).join('\n      ')
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
      contents.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
    }

    const response = await fetchWithRetry(() => aiClient.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: (() => {
          const schemaObj: any = {
            type: Type.OBJECT,
            properties: {
              examType: { type: Type.STRING, description: "Type of banking exam (e.g. SBI, IBPS, RRB, LIC)" },
              examRole: { type: Type.STRING, description: "Role of the exam (e.g. PO, Clerk, AO, Assistant)" },
              examPhase: { type: Type.STRING, description: "Phase of the exam (e.g. Prelims, Mains)" },
              examScope: { type: Type.STRING, description: "Scope of the exam (e.g. Full, Sectional)" },
              mockName: { type: Type.STRING, description: "Name of the mock, without subject prefixes" },
              platform: { type: Type.STRING, description: "Platform name like Testbook, PracticeMock, etc." },
              detectedSubject: { type: Type.STRING, description: "If sectional, one of the subject keys. Else null" },
              date: { type: Type.STRING, description: "Date of the mock in YYYY-MM-DD" },
              score: { type: Type.STRING, description: "Extract numerator. E.g. 16/30 -> 16" },
              percentile: { type: Type.STRING, description: "E.g. 84.62" },
              percentage: { type: Type.STRING },
              accuracy: { type: Type.STRING, description: "E.g. 72.93" }
            }
          };

          if (isDynamic) {
            subjects.forEach((s: any) => {
              schemaObj.properties[s.id] = {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.STRING },
                  percentile: { type: Type.STRING },
                  accuracy: { type: Type.STRING }
                }
              };
            });
          } else {
            ['quant', 'reasoning', 'english', 'ga', 'computer'].forEach(key => {
              schemaObj.properties[key] = {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.STRING },
                  percentile: { type: Type.STRING },
                  accuracy: { type: Type.STRING }
                }
              };
            });
          }
          return schemaObj;
        })()
      }
    }));

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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split('Bearer ')[1];
    


    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res.status(403).json({ error: "Forbidden: Invalid token. " + (authErr?.message || "") });
    }

    const { promptText, customApiKey } = req.body;
    const aiClient = getAiClient(customApiKey);

    const actualPrompt = promptText || 'random exciting achievement badge';

    // 1. Generate Badge Name using flash model
    const textPrompt = `You are a designer. Create a short name for a badge based on this description: "${actualPrompt}". Max 4-5 words. Return ONLY a JSON object: {"name": "The Name"}`;
    
    const nameResponse = await fetchWithRetry(() => aiClient.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [{ role: 'user', parts: [{ text: textPrompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
             name: { type: Type.STRING }
          }
        }
      }
    }));
    
    let badgeName = "Achievement Badge";
    try {
       const parsed = JSON.parse(nameResponse.text || "{}");
       if (parsed.name) badgeName = parsed.name;
    } catch(e) {}

    // 2. Generate Image using image model
    const imagePrompt = `A clean, vector-style flat icon badge for an achievement: ${actualPrompt}. Keep it simple, centered, colorful, white background, no text on the image.`;
    const imageResponse = await fetchWithRetry(() => aiClient.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: imagePrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    }));

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
        imageBase64: base64Image
    });
    
  } catch (error: any) {
    console.error("Gemini Error:", error);
    let errorMessage = String(error.message || error);
    if (errorMessage.includes("429") || errorMessage.includes("Quota exceeded")) {
       errorMessage = "Image generation requires a billing-enabled API key or your current quota was exceeded. Please open Settings -> Secrets to select/provide a custom API Key.";
    }
    res.status(500).json({ error: errorMessage });
  }
});

export default app;
