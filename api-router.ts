import express from "express";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
app.use(express.json({ limit: "50mb" }));

// Helper
const getAiClient = (customApiKey?: string) => {
  let keyToUse = customApiKey || process.env.GEMINI_API_KEY;
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
      model: "gemini-2.5-flash",
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
          },
          required: ["examType", "mockName"]
        }
      }
    }));

    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    res.json(parsed);
    
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

// API route for Gemini extraction - Scorecard
app.post("/api/extract-scorecard", async (req, res) => {
  try {
    const { images, customApiKey } = req.body;
    const aiClient = getAiClient(customApiKey);
    
    const prompt = `
      Extract the following details from the uploaded banking exam mock test scorecard image(s). 
      There might be multiple images (e.g. one for scores, one for percentiles). Combine the information.
      
      - Exam Type (e.g., 'SBI', 'IBPS', 'RRB', etc.)
      - Exam Role (e.g., 'PO', 'Clerk', 'AO', etc.)
      - Exam Phase (e.g., 'Prelims', 'Mains')
      - Exam Scope (e.g., 'Full', 'Sectional')
      - Mock Name (e.g., 'Mock Test 1', 'Mains Full Test 3', 'Test 1', etc.). IMPORTANT: If it's a Sectional test, DO NOT include the subject name in the mock name. For example, if it says "Numerical Ability Sectional Test 1", return just "Test 1" or "Sectional Test 1" as the mockName.
      - Platform (e.g., 'Testbook', 'PracticeMock', 'Guidely', 'Smartkeeda', 'Oliveboard', 'Adda247'). Look at logos, URLs, or UI style.
      - Date of test (YYYY-MM-DDTHH:mm format if possible)
      - Overall Score (number)
      - Overall Percentile (number, 0-100)
      - Overall Percentage (number, 0-100)
      - Overall Accuracy (number, 0-100)
      - detectedSubject (If it is a sectional test, identify the subject: "quant", "reasoning", "english", or "ga")
      
      Sectional details containing Score, Percentile, and Accuracy for:
      - Quant (Quantitative Aptitude / Numerical Ability)
      - Reasoning (Reasoning Ability)
      - English (English Language)
      - GA (General Awareness / Financial Awareness / Computer)
      
      Return as structured JSON. If any field is not visible, infer a reasonable default like null or an empty string, or do your best to detect it.
    `;

    const contents: any[] = [{ text: prompt }];
    for (const img of images) {
      contents.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
    }

    const response = await fetchWithRetry(() => aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            examType: { type: Type.STRING, description: "Type of banking exam (e.g. SBI, IBPS, RRB, LIC)" },
            examRole: { type: Type.STRING, description: "Role of the exam (e.g. PO, Clerk, AO, Assistant)" },
            examPhase: { type: Type.STRING, description: "Phase of the exam (e.g. Prelims, Mains)" },
            examScope: { type: Type.STRING, description: "Scope of the exam (e.g. Full, Sectional)" },
            mockName: { type: Type.STRING, description: "Name of the mock, without subject prefixes" },
            platform: { type: Type.STRING, description: "Platform name like Testbook, PracticeMock, etc." },
            detectedSubject: { type: Type.STRING, description: "If sectional, one of: quant, reasoning, english, ga. Else null" },
            date: { type: Type.STRING, description: "Date of the mock in YYYY-MM-DD" },
            score: { type: Type.NUMBER },
            percentile: { type: Type.NUMBER },
            percentage: { type: Type.NUMBER },
            accuracy: { type: Type.NUMBER },
            quant: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER },
                accuracy: { type: Type.NUMBER }
              }
            },
            reasoning: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER },
                accuracy: { type: Type.NUMBER }
              }
            },
            english: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER },
                accuracy: { type: Type.NUMBER }
              }
            },
            ga: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER },
                accuracy: { type: Type.NUMBER }
              }
            }
          },
          required: ["examType", "mockName"]
        }
      }
    }));

    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    res.json(parsed);
    
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

export default app;
