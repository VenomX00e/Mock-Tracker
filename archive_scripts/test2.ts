import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const customKey = process.env.GEMINI_API_KEY;
  if (!customKey) { console.error("No key"); return; }
  const aiClient = new GoogleGenAI({ apiKey: customKey });

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Just test. Respond with valid json.",
      config: {
        responseMimeType: "application/json"
      }
    });
    console.log(response.text);
  } catch (e: any) {
    console.error("Gemini Error: ", e.message);
  }
}
run();
