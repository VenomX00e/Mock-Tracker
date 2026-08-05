const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function main() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemma-4-26b-a4b-it',
      contents: "Hello"
    });
    console.log(response.text);
  } catch (e) {
    console.error(e.message);
  }
}
main();
