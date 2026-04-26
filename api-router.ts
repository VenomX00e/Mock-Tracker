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

// Helper to format Gemini err
const formatGeminiError = (error: any) => {
  try {
    const errStr = error.message || String(error);
    const jsonMatch = errStr.match(/\{.*\}/s);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error && parsed.error.message) {
        return parsed.error.message;
      }
    }
  } catch (e) {}
  return error.message || "Failed to process";
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

    const response = await aiClient.models.generateContent({
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
    });

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
      - Mock Name (e.g., 'Mock Test 1', 'Mains Full Test 3', etc.)
      - Date of test (YYYY-MM-DDTHH:mm format if possible)
      - Overall Score (number)
      - Overall Percentile (number, 0-100)
      - Overall Percentage (number, 0-100)
      
      Sectional details containing Score and Percentile for:
      - Quant (Quantitative Aptitude / Numerical Ability)
      - Reasoning (Reasoning Ability)
      - English (English Language)
      - GA (General Awareness / Financial Awareness / Computer)
      
      Return as structured JSON. If any field is not visible, infer a reasonable default like 0 or an empty string, or do your best to detect it.
    `;

    const contents: any[] = [{ text: prompt }];
    for (const img of images) {
      contents.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
    }

    const response = await aiClient.models.generateContent({
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
            mockName: { type: Type.STRING, description: "Name of the mock" },
            date: { type: Type.STRING, description: "Date of the mock in YYYY-MM-DD" },
            score: { type: Type.NUMBER },
            percentile: { type: Type.NUMBER },
            percentage: { type: Type.NUMBER },
            quant: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER }
              }
            },
            reasoning: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER }
              }
            },
            english: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER }
              }
            },
            ga: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER }
              }
            }
          },
          required: ["examType", "mockName"]
        }
      }
    });

    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    res.json(parsed);
    
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

export default app;
