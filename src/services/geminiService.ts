import { GoogleGenAI, Type } from "@google/genai";
import { MockScore } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseScorecardImage(images: { base64: string, mimeType: string }[]): Promise<Partial<MockScore>> {
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
    
    Return as structured JSON. If any field is not visible, infer a reasonable default like 0 or an empty string, or do your best to detect it.
  `;

  try {
    const contents: any[] = [{ text: prompt }];
    for (const img of images) {
      contents.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
            }
          },
          required: ["examType", "mockName", "score", "percentile", "percentage"]
        }
      }
    });

    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    
    return {
      examType: parsed.examType || "Unknown Exam",
      examRole: parsed.examRole || "",
      examPhase: parsed.examPhase || "",
      examScope: parsed.examScope || "",
      mockName: parsed.mockName || "Unknown Mock",
      date: parsed.date || new Date().toISOString().split('T')[0],
      score: Number(parsed.score) || 0,
      percentile: Number(parsed.percentile) || 0,
      percentage: Number(parsed.percentage) || 0,
      quant: {
        score: Number(parsed.quant?.score) || 0,
        percentile: Number(parsed.quant?.percentile) || 0,
      },
      reasoning: {
        score: Number(parsed.reasoning?.score) || 0,
        percentile: Number(parsed.reasoning?.percentile) || 0,
      },
      english: {
        score: Number(parsed.english?.score) || 0,
        percentile: Number(parsed.english?.percentile) || 0,
      }
    };
  } catch (error) {
    console.error("Error parsing scorecard image:", error);
    throw new Error("Failed to parse scorecard image");
  }
}
