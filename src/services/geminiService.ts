import { GoogleGenAI, Type } from "@google/genai";
import { MockScore } from "../types";

let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (aiClient) return aiClient;
  const key = process.env.GEMINI_API_KEY || localStorage.getItem('geminiApiKey');
  if (!key) {
    throw new Error('No Gemini API key found. Please configure it by clicking the app logo.');
  }
  aiClient = new GoogleGenAI({ apiKey: key });
  return aiClient;
}

export async function parseMockAnnouncementImage(images: { base64: string, mimeType: string }[]): Promise<any> {
  // ...

  const prompt = `
    Extract the following details from the uploaded banking exam live mock test announcement image(s). 
    There might be multiple images. Combine the information.
    
    - Exam Type (e.g., 'SBI', 'IBPS', 'RRB', etc.)
    - Exam Role (e.g., 'PO', 'Clerk', 'AO', etc.)
    - Exam Phase (e.g., 'Prelims', 'Mains')
    - Exam Scope (e.g., 'Full', 'Sectional')
    - Mock Name (e.g., 'Mock Test 1', 'Live Mock 3', etc.)
    - Platform (e.g. 'PracticeMock', 'Testbook', 'Guidely', 'Oliveboard')
    
    Return as structured JSON. If any field is not visible, infer a reasonable default or an empty string, or do your best to detect it.
  `;

  try {
    const contents: any[] = [{ text: prompt }];
    for (const img of images) {
      contents.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
    }

    const response = await getAiClient().models.generateContent({
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
    
    return {
      examType: parsed.examType || "",
      examRole: parsed.examRole || "",
      examPhase: parsed.examPhase || "",
      examScope: parsed.examScope || "",
      mockName: parsed.mockName || "",
      platform: parsed.platform || ""
    };
  } catch (error: any) {
    console.error("Error parsing mock announcement image:", error);
    throw new Error(error.message || "Failed to parse announcement image");
  }
}

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
    - GA (General Awareness / Financial Awareness / Computer)
    
    Return as structured JSON. If any field is not visible, infer a reasonable default like 0 or an empty string, or do your best to detect it.
  `;

  try {
    const contents: any[] = [{ text: prompt }];
    for (const img of images) {
      contents.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
    }

    const response = await getAiClient().models.generateContent({
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
    
    return {
      examType: parsed.examType || "Unknown Exam",
      examRole: parsed.examRole || "",
      examPhase: parsed.examPhase || "",
      examScope: parsed.examScope || "",
      mockName: parsed.mockName || "Unknown Mock",
      date: parsed.date || new Date().toISOString().split('T')[0],
      score: parsed.score != null ? Number(parsed.score) : null,
      percentile: parsed.percentile != null ? Number(parsed.percentile) : null,
      percentage: parsed.percentage != null ? Number(parsed.percentage) : null,
      quant: {
        score: parsed.quant?.score != null ? Number(parsed.quant.score) : null,
        percentile: parsed.quant?.percentile != null ? Number(parsed.quant.percentile) : null,
      },
      reasoning: {
        score: parsed.reasoning?.score != null ? Number(parsed.reasoning.score) : null,
        percentile: parsed.reasoning?.percentile != null ? Number(parsed.reasoning.percentile) : null,
      },
      english: {
        score: parsed.english?.score != null ? Number(parsed.english.score) : null,
        percentile: parsed.english?.percentile != null ? Number(parsed.english.percentile) : null,
      },
      ga: {
        score: parsed.ga?.score != null ? Number(parsed.ga.score) : null,
        percentile: parsed.ga?.percentile != null ? Number(parsed.ga.percentile) : null,
      }
    };
  } catch (error: any) {
    console.error("Error parsing scorecard image:", error);
    throw new Error(error.message || "Failed to parse scorecard image");
  }
}
