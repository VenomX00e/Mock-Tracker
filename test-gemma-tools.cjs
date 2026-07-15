const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function main() {
  try {
    const response = await ai.models.generateContent({
      model: "gemma-4-26b-a4b-it",
      contents: [{ role: "user", parts: [{text: "What is the weather in Paris?"}] }],
      config: {
        tools: [{
          functionDeclarations: [{
            name: "get_weather",
            description: "Get weather",
            parameters: { type: "OBJECT", properties: { location: { type: "STRING" } } }
          }]
        }]
      }
    });
    console.log("SUCCESS:", response.text || JSON.stringify(response.functionCalls));
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
main();
