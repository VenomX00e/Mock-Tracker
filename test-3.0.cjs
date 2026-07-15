const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function main() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.0-flash',
      contents: "Hello"
    });
    console.log(response.text);
  } catch (e) {
    console.error(e.message);
  }
}
main();
