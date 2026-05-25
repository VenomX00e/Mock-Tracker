import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

async function testGemini() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.log("No GEMINI_API_KEY");
    return;
  }
  const aiClient = new GoogleGenAI({ apiKey: geminiApiKey });
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
    },
    required: ["examType", "mockName"]
  };
  
  [...['quant', 'reasoning', 'english', 'ga']].forEach(key => {
    schemaObj.properties[key] = {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.STRING, description: "Extract numerator. E.g. 16/30 -> 16" },
        percentile: { type: Type.STRING, description: "E.g. 84.62" },
        accuracy: { type: Type.STRING, description: "E.g. 72.93" }
      }
    };
  });

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Just output some dummy valid json array or anything",
      config: {
        responseMimeType: "application/json",
        responseSchema: schemaObj
      }
    });

    console.log("Success", response.text);
  } catch (error: any) {
    console.error("Error: ", error.message || error);
    if (error.status) console.log(error.status);
    if (error.details) console.log(error.details);
  }
}

testGemini();
