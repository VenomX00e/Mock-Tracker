const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function main() {
  try {
    // create a dummy image
    const imagePart = {
        inlineData: {
            data: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64").toString("base64"),
            mimeType: "image/png"
        }
    };
    const response = await ai.models.generateContent({
      model: "gemma-4-26b-a4b-it",
      contents: [{ role: "user", parts: [imagePart, {text: "What color is this?"}] }]
    });
    console.log("SUCCESS:", response.text);
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
main();
