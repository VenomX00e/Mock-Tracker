const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function main() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: "Hello",
      config: { tools: [{ googleSearch: {} }] }
    });
    console.log("3.5-flash SUCCESS");
  } catch (e) {
    console.log("3.5-flash ERROR:", e.message);
  }

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Hello",
    });
    console.log("3-preview SUCCESS");
  } catch (e) {
    console.log("3-preview ERROR:", e.message);
  }
}
main();
