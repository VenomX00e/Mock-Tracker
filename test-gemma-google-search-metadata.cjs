const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function main() {
  try {
    const response = await ai.models.generateContent({
      model: "gemma-4-26b-a4b-it",
      contents: "What is the weather in Paris?",
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    console.log("SUCCESS:", response.text);
    console.log("METADATA:", JSON.stringify(response.candidates[0].groundingMetadata, null, 2));
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
main();
