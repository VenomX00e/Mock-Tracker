const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function main() {
  try {
    const response = await ai.models.generateContent({
      model: "gemma-4-26b-a4b-it",
      contents: "Hi",
      config: {
        systemInstruction: "You are a pirate. Answer everything like a pirate."
      }
    });
    console.log("SUCCESS:", response.text);
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
main();
