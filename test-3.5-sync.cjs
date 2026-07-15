const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function main() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: "Hello"
    });
    console.log("SUCCESS:", response.text);
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
main();
