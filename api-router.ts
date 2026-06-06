import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import admin from "firebase-admin";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let firebaseConfig: any = {};
try {
  firebaseConfig = require("./firebase-applet-config.json");
} catch (e: any) {
  console.warn("Could not lazily read firebase config:", e.message);
}

if (!admin.apps.length && firebaseConfig.projectId) {
  admin.initializeApp({ projectId: firebaseConfig.projectId });
}

const app = express();
app.use((req, res, next) => {
  // If Vercel already parsed it into an object that is not a Buffer
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    (req as any)._body = true;
  }
  next();
});
app.use(express.json({ limit: "50mb" }));

// Helper
const getAiClient = (customApiKey?: string) => {
  let keyToUse =
    customApiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!keyToUse)
    throw new Error("No Gemini API key available. Please add an API key.");
  return new GoogleGenAI({ apiKey: keyToUse });
};

// Helper to retry Gemini requests
const fetchWithRetry = async (
  fn: () => Promise<any>,
  retries = 2,
  delayMs = 1500,
) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (i === retries) throw error;
      const msg = error.message || String(error);
      if (
        msg.includes("503") ||
        msg.includes("429") ||
        msg.includes("high demand")
      ) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw error;
    }
  }
};

// Helper to format Gemini err
const formatGeminiError = (error: any) => {
  try {
    const errStr = error.message || String(error);
    if (
      errStr.includes("503") ||
      errStr.includes("high demand") ||
      errStr.includes("429")
    ) {
      return "This AI model is currently experiencing high demand. Please try again in a few moments.";
    }
    const jsonMatch = errStr.match(/\{.*\}/s);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error && parsed.error.message) {
        return parsed.error.message;
      }
    }
  } catch (e) {}
  return error.message || "Failed to process, please try again.";
};

// API route for Gemini extraction - Mock Announcement
app.post("/api/extract-mock", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];

    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res
        .status(403)
        .json({
          error: "Forbidden: Invalid token. " + (authErr?.message || ""),
        });
    }

    const { images, customApiKey } = req.body;
    const aiClient = getAiClient(customApiKey);

    const prompt = `
      Extract the following details from the uploaded banking exam live mock test announcement image(s). 
      There might be multiple images. Combine the information.
      
      - Exam Type (e.g., 'SBI', 'IBPS', 'RRB', etc.)
      - Exam Role (e.g., 'PO', 'Clerk', 'AO', etc.)
      - Exam Phase (e.g., 'Prelims', 'Mains')
      - Exam Scope (e.g., 'Full', 'Sectional', 'Subject-wise')
      - Mock Name (e.g., 'Mock Test 1', 'Live Mock 3', etc.)
      - Platform (e.g. 'PracticeMock', 'Testbook', 'Guidely', 'Oliveboard')
      
      Return as structured JSON. If any field is not visible, infer a reasonable default or an empty string, or do your best to detect it.
    `;

    const contents: any[] = [{ text: prompt }];
    for (const img of images) {
      contents.push({
        inlineData: { data: img.base64, mimeType: img.mimeType },
      });
    }

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: "gemini-3.1-flash-lite",
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
              platform: { type: Type.STRING },
            },
          },
        },
      }),
    );

    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: String(error.message || error) });
  }
});

// API route for Gemini extraction - Scorecard
app.post("/api/extract-scorecard", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];

    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res
        .status(403)
        .json({
          error: "Forbidden: Invalid token. " + (authErr?.message || ""),
        });
    }

    const { images, customApiKey, subjects } = req.body;
    const aiClient = getAiClient(customApiKey);

    const isDynamic =
      subjects && Array.isArray(subjects) && subjects.length > 0;
    const subjectListStr = isDynamic
      ? subjects.map((s: any) => `- ${s.name} (Key: ${s.id})`).join("\n      ")
      : `
      - Quant (Key: quant)
      - Reasoning (Key: reasoning)
      - English (Key: english)
      - GA (Key: ga)`;

    const prompt = `
      Extract the following details from the uploaded mock test scorecard image(s). 
      There might be multiple images (e.g. one for scores, one for percentiles). Combine the information.
      
      - Exam Type (e.g., 'SBI', 'IBPS', 'RRB', 'SSC', 'CAT', etc.)
      - Exam Role (e.g., 'PO', 'Clerk', 'AO', etc.)
      - Exam Phase (e.g., 'Prelims', 'Mains')
      - Exam Scope (e.g., 'Full', 'Sectional')
      - Mock Name (e.g., 'Mock Test 1', 'Mains Full Test 3', 'Test 1', etc.). IMPORTANT: If it's a Sectional test, DO NOT include the subject name in the mock name. For example, if it says "Numerical Ability Sectional Test 1", return just "Test 1" or "Sectional Test 1" as the mockName.
      - Platform (e.g., 'Testbook', 'PracticeMock', 'Guidely', 'Smartkeeda', 'Oliveboard', 'Adda247'). Look at logos, URLs, or UI style.
      - Date of test (YYYY-MM-DDTHH:mm format if possible)
      - Overall Score (number, extract only the numerator or decimal number! e.g. "16/30" -> 16, "63/100" -> 63)
      - Overall Percentile (number, 0-100)
      - Overall Percentage (number, 0-100)
      - Overall Accuracy (number, 0-100). If not printed but total correct and total attempted are visible, calculate it as (total correct / total attempted) * 100.
      - detectedSubject (If it is a sectional test, identify the subject key from the list below. Else null)
      
      Sectional details containing Score (number, extract only the numerator or decimal number! e.g. "16/30" -> 16, "24.75" -> 24.75), Percentile, and Accuracy (if accuracy is not printed but correct/attempted are visible, calculate it as (correct/attempted)*100) for:
      ${subjectListStr}
      
      Return as structured JSON. If any field is not visible, infer a reasonable default like null or an empty string, or do your best to detect it.
    `;

    const contents: any[] = [{ text: prompt }];
    for (const img of images) {
      contents.push({
        inlineData: { data: img.base64, mimeType: img.mimeType },
      });
    }

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: (() => {
            const schemaObj: any = {
              type: Type.OBJECT,
              properties: {
                examType: {
                  type: Type.STRING,
                  description:
                    "Type of banking exam (e.g. SBI, IBPS, RRB, LIC)",
                },
                examRole: {
                  type: Type.STRING,
                  description:
                    "Role of the exam (e.g. PO, Clerk, AO, Assistant)",
                },
                examPhase: {
                  type: Type.STRING,
                  description: "Phase of the exam (e.g. Prelims, Mains)",
                },
                examScope: {
                  type: Type.STRING,
                  description: "Scope of the exam (e.g. Full, Sectional)",
                },
                mockName: {
                  type: Type.STRING,
                  description: "Name of the mock, without subject prefixes",
                },
                platform: {
                  type: Type.STRING,
                  description:
                    "Platform name like Testbook, PracticeMock, etc.",
                },
                detectedSubject: {
                  type: Type.STRING,
                  description:
                    "If sectional, one of the subject keys. Else null",
                },
                date: {
                  type: Type.STRING,
                  description: "Date of the mock in YYYY-MM-DD",
                },
                score: {
                  type: Type.STRING,
                  description: "Extract numerator. E.g. 16/30 -> 16",
                },
                percentile: { type: Type.STRING, description: "E.g. 84.62" },
                percentage: { type: Type.STRING },
                accuracy: { type: Type.STRING, description: "E.g. 72.93" },
              },
            };

            if (isDynamic) {
              subjects.forEach((s: any) => {
                schemaObj.properties[s.id] = {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.STRING },
                    percentile: { type: Type.STRING },
                    accuracy: { type: Type.STRING },
                  },
                };
              });
            } else {
              ["quant", "reasoning", "english", "ga", "computer"].forEach(
                (key) => {
                  schemaObj.properties[key] = {
                    type: Type.OBJECT,
                    properties: {
                      score: { type: Type.STRING },
                      percentile: { type: Type.STRING },
                      accuracy: { type: Type.STRING },
                    },
                  };
                },
              );
            }
            return schemaObj;
          })(),
        },
      }),
    );

    const jsonText = response.text || "{}";
    const parsed = JSON.parse(jsonText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: String(error.message || error) });
  }
});

app.post("/api/generate-badge", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];

    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res
        .status(403)
        .json({
          error: "Forbidden: Invalid token. " + (authErr?.message || ""),
        });
    }

    const { promptText, customApiKey } = req.body;
    const aiClient = getAiClient(customApiKey);

    const actualPrompt = promptText || "random exciting achievement badge";

    // 1. Generate Badge Name using flash model
    const textPrompt = `You are a designer. Create a short name for a badge based on this description: "${actualPrompt}". Max 4-5 words. Return ONLY a JSON object: {"name": "The Name"}`;

    const nameResponse = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: [{ role: "user", parts: [{ text: textPrompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
            },
          },
        },
      }),
    );

    let badgeName = "Achievement Badge";
    try {
      const parsed = JSON.parse(nameResponse.text || "{}");
      if (parsed.name) badgeName = parsed.name;
    } catch (e) {}

    // 2. Generate Image using image model
    const imagePrompt = `A clean, vector-style flat icon badge for an achievement: ${actualPrompt}. Keep it simple, centered, colorful, white background, no text on the image.`;
    const imageResponse = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: imagePrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      }),
    );

    let base64Image = null;
    if (imageResponse.candidates && imageResponse.candidates[0].content.parts) {
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = `data:image/jpeg;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("No image was generated by the model");
    }

    res.json({
      name: badgeName,
      imageBase64: base64Image,
    });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    let errorMessage = String(error.message || error);
    if (
      errorMessage.includes("429") ||
      errorMessage.includes("Quota exceeded")
    ) {
      errorMessage =
        "Image generation requires a billing-enabled API key or your current quota was exceeded. Please open Settings -> Secrets to select/provide a custom API Key.";
    }
    res.status(500).json({ error: errorMessage });
  }
});

// API route for Learning AI Tutor Chat
app.post("/api/learning-chat", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];

    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res
        .status(403)
        .json({
          error: "Forbidden: Invalid token. " + (authErr?.message || ""),
        });
    }

    const { messages, customApiKey, model, useWebSearch, chatMode } = req.body;

    if (!customApiKey) {
      return res
        .status(403)
        .json({
          error:
            "A personal Gemini API key is required to use this feature. Please add your key in the AI Tutor Settings.",
        });
    }

    const aiClient = new GoogleGenAI({ apiKey: customApiKey });

    let modeInstruction = "";
    if (chatMode === 'math') {
      modeInstruction = `
You are an expert Math tutor for competitive exams. Do not give conversational wrappers. Provide a rapid, step-by-step, exam-focused approach to solve the problem. Keep your explanations exceptionally concise and structured. Only provide a deep theoretical explanation if the user explicitly asks for 'full explanation'.
`;
    } else if (chatMode === 'english') {
      modeInstruction = `
You are an expert English tutor for competitive exams. Provide brief, rule-based explanations for grammar, vocabulary, or comprehension. Keep explanations concise, structured, and exam-focused.
`;
    } else if (chatMode === 'reasoning') {
      modeInstruction = `
You are an expert analytical Reasoning tutor. Follow these STRICT rules: 1. Do NOT immediately declare the final answer to puzzles. Instead, outline a detailed step-by-step approach to solve it. 2. For seating arrangements (circular, linear), always suggest applying the 'Thread Method' to unfold the problem. Include the traditional approach only if requested. 3. If the user provides an attempted answer, you must cross-check their answer against EVERY given condition in the problem. If their answer violates a condition, explicitly state which condition fails. If their answer satisfies ALL conditions, state 'Your arrangement satisfies all conditions and is correct'.
`;
    }

    const systemInstruction = `You are a helpful and encouraging AI Tutor focused on helping the user learn. 
Provide concise, clear, and educational responses. If explaining complex topics, use analogies. ${modeInstruction}

CRITICAL INSTRUCTION FOR NAVIGATION LINKS:
- DO NOT provide UI navigation links (e.g., Action Items, Dashboard, Mock Tests) if the user is asking a question about a concept, studying, learning a topic, or math/science. 
- ONLY provide explanations of app features and markdown navigation buttons IF AND ONLY IF the user explicitly asks about the app's features, navigation, what the app can do, OR if they send a very generic greeting (like "hi", "hello" without asking a question).
- Available pages and their relative URLs for markdown links:
  - Home: [Go to Home](/home)
  - Dashboard: [View Dashboard](/dashboard)
  - Action Items / Tasks: [Go to Tasks](/tasks)
  - Community: [Explore Community](/community)
  - Learning: [Learning Hub](/learning)
  - Profile: [View Profile](/profile)`;

    const contents = messages.map((m: any) => {
      const parts: any[] = [];
      if (m.attachments && Array.isArray(m.attachments)) {
        m.attachments.forEach((att: any) => {
          parts.push({
            inlineData: {
              data: att.data,
              mimeType: att.mimeType,
            },
          });
          if (att.pages && att.mimeType === "application/pdf") {
            parts.push({
              text: `\n[NOTE FOR AI: Only extract information and answer questions based on pages ${att.pages} of this PDF Document.]\n`,
            });
          }
        });
      }
      parts.push({ text: m.text });
      return {
        role: m.role || "user",
        parts,
      };
    });

    const config: any = {
      systemInstruction,
    };

    if (useWebSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: model || "gemini-3.1-flash-lite",
        contents: contents,
        config: config,
      }),
    );

    let citations: { uri: string; title: string }[] = [];
    if (response?.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      const chunks = response.candidates[0].groundingMetadata.groundingChunks;
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri && chunk.web?.title) {
          citations.push({
            uri: chunk.web.uri,
            title: chunk.web.title,
          });
        }
      });
    }

    res.json({
      reply: response.text || "Sorry, I couldn't generate a response.",
      citations,
    });
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

app.post("/api/tutor-chat-stream", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];

    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res
        .status(403)
        .json({
          error: "Forbidden: Invalid token. " + (authErr?.message || ""),
        });
    }

    const { messages, customApiKey, model, useWebSearch, chatMode } = req.body;

    if (!customApiKey) {
      return res
        .status(403)
        .json({
          error:
            "A personal Gemini API key is required to use this feature. Please add your key in the AI Tutor Settings.",
        });
    }

    const aiClient = new GoogleGenAI({ apiKey: customApiKey });

    let modeInstruction = "";
    if (chatMode === 'math') {
      modeInstruction = `
You are an expert Math tutor for competitive exams. Do not give conversational wrappers. Provide a rapid, step-by-step, exam-focused approach to solve the problem. Keep your explanations exceptionally concise and structured. Only provide a deep theoretical explanation if the user explicitly asks for 'full explanation'.
`;
    } else if (chatMode === 'english') {
      modeInstruction = `
You are an expert English tutor for competitive exams. Provide brief, rule-based explanations for grammar, vocabulary, or comprehension. Keep explanations concise, structured, and exam-focused.
`;
    } else if (chatMode === 'reasoning') {
      modeInstruction = `
You are an expert analytical Reasoning tutor. Follow these STRICT rules: 1. Do NOT immediately declare the final answer to puzzles. Instead, outline a detailed step-by-step approach to solve it. 2. For seating arrangements (circular, linear), always suggest applying the 'Thread Method' to unfold the problem. Include the traditional approach only if requested. 3. If the user provides an attempted answer, you must cross-check their answer against EVERY given condition in the problem. If their answer violates a condition, explicitly state which condition fails. If their answer satisfies ALL conditions, state 'Your arrangement satisfies all conditions and is correct'.
`;
    }

    const systemInstruction = `You are a helpful and encouraging AI Tutor focused on helping the user learn. 
Provide concise, clear, and educational responses. If explaining complex topics, use analogies. ${modeInstruction}

CRITICAL INSTRUCTION FOR NAVIGATION LINKS:
- DO NOT provide UI navigation links (e.g., Action Items, Dashboard, Mock Tests) if the user is asking a question about a concept, studying, learning a topic, or math/science. 
- ONLY provide explanations of app features and markdown navigation buttons IF AND ONLY IF the user explicitly asks about the app's features, navigation, what the app can do, OR if they send a very generic greeting (like "hi", "hello" without asking a question).
- Available pages and their relative URLs for markdown links:
  - Home: [Go to Home](/home)
  - Dashboard: [View Dashboard](/dashboard)
  - Action Items / Tasks: [Go to Tasks](/tasks)
  - Community: [Explore Community](/community)
  - Learning: [Learning Hub](/learning)
  - Profile: [View Profile](/profile)`;

    const contents = messages.map((m: any) => {
      const parts: any[] = [];
      if (m.attachments && Array.isArray(m.attachments)) {
        m.attachments.forEach((att: any) => {
          parts.push({
            inlineData: {
              data: att.data,
              mimeType: att.mimeType,
            },
          });
          if (att.pages && att.mimeType === "application/pdf") {
            parts.push({
              text: `\n[NOTE FOR AI: Only extract information and answer questions based on pages ${att.pages} of this PDF Document.]\n`,
            });
          }
        });
      }
      parts.push({ text: m.text });
      return {
        role: m.role || "user",
        parts,
      };
    });

    const config: any = {
      systemInstruction,
    };

    if (useWebSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    try {
      const responseStream = await aiClient.models.generateContentStream({
        model: model || "gemini-3.1-flash-lite",
        contents: contents,
        config: config,
      });

      let groundingChunksSet = new Set<string>();
      let citations: { uri: string; title: string }[] = [];

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
        if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
          const metadataChunks = chunk.candidates[0].groundingMetadata.groundingChunks;
          metadataChunks.forEach((metaChunk: any) => {
            if (metaChunk.web?.uri && metaChunk.web?.title) {
              const key = metaChunk.web.uri;
              if (!groundingChunksSet.has(key)) {
                groundingChunksSet.add(key);
                citations.push({
                  uri: metaChunk.web.uri,
                  title: metaChunk.web.title,
                });
              }
            }
          });
        }
      }

      if (citations.length > 0) {
        res.write(`data: ${JSON.stringify({ citations })}\n\n`);
      }
      res.end();
    } catch (genError: any) {
      res.write(`data: ${JSON.stringify({ error: formatGeminiError(genError) })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    console.error("Gemini Chat Stream Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: formatGeminiError(error) });
    }
  }
});

app.post("/api/generate-word-details", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token);

    const { word, customApiKey, model } = req.body;
    if (!customApiKey)
      return res.status(403).json({ error: "API key required" });

    const aiClient = new GoogleGenAI({ apiKey: customApiKey });
    const prompt = `Provide the English meaning and a helpful mnemonic (trick to remember) for the word "${word}". Return ONLY a JSON object: {"meaning": "...", "mnemonic": "..."}`;

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: model || "gemini-3.1-flash-lite",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              meaning: { type: Type.STRING },
              mnemonic: { type: Type.STRING },
            },
          },
        },
      }),
    );

    // Safely extract JSON in case the LLM wrapped it in markdown
    const responseText = response.text || "{}";
    const cleanText = responseText
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();
    const match = cleanText.match(/\{[\s\S]*\}/);
    const finalJSON = match ? match[0] : cleanText;
    res.json(JSON.parse(finalJSON));
  } catch (error: any) {
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

app.post("/api/extract-document", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token);

    const { documents, base64Data, mimeType, customApiKey, model, textData } = req.body;
    if (!customApiKey)
      return res.status(403).json({ error: "API key required" });

    const aiClient = new GoogleGenAI({ apiKey: customApiKey });
    const prompt = `You are a strict data extraction assistant. Extract vocabulary words, idioms, phrasal verbs, and one-word substitutions from the provided document.

CRITICAL INSTRUCTIONS FOR VOCABULARY:
- Create a SEPARATE object in the array for EACH individual word found in the document. For instance, if the image lists 10 numbered words, the 'vocabulary' array MUST contain exactly 10 separate objects.
- Do NOT clump all words into a single list item.
- For each piece of information, you MUST use the appropriate distinct fields exactly as requested:
  * 'word': Only the vocabulary word itself (e.g. "Alacrity", "Beneath"). Do NOT include the part of speech, meanings, synonyms, antonyms, or examples here. Remove the numbering (e.g. "1", "2").
  * 'pos': The part of speech of the word, if given (e.g. "Noun", "Verb", "Adj", "Adv", "Prep", "Pron"). Extract this from the parentheses next to the word and format it properly (Titlecase).
  * 'meaning': The definition of the word. Include both the Hindi meaning (found in parentheses next to the word) and the English meaning (found below the word).
  * 'synonyms': An array of individual synonym strings (e.g., ["eagerness", "readiness"]).
  * 'antonyms': An array of individual antonym strings (e.g., ["reluctance"]).
  * 'example': A full example sentence using the word. Look for a pen icon or sentence on the right side. Include Hindi translation if present.
  * 'mnemonic': A trick to remember the word, if any is provided.
  * 'additional': When an 'Additional' section is present under a vocabulary word, capture all text (including parenthetical categories, phrases, and idioms) into the word's additional field exactly as formatted. Do NOT extract idioms, one-word substitutions, or phrasal verbs found inside a word's 'Additional' block into the standalone idioms or phrasalVerbs arrays. They belong exclusively to that specific word.

For idioms, phrasal verbs, and one-word substitutions, strictly separate 'text' (only the phrase itself without the meaning), 'meaning' (the explanation or definition of the phrase), and 'example' (if an example sentence is provided).
If the document lists definitions separated by colons or hyphens (e.g. "Phrase: Meaning" or "Phrase - Meaning"), YOU MUST split them appropriately. The 'text' MUST ONLY contain "Phrase" and the 'meaning' MUST ONLY contain "Meaning". Do NOT include the meaning inside the 'text' field.
Return ONLY structured JSON adhering to this schema. If a field or category is not present, return an empty array or empty string.`;

    const parts: any[] = [{ text: prompt }];

    if (textData) {
      parts[0].text = prompt + "\n\n--- SOURCE TEXT TO EXTRACT FROM ---\n" + textData;
    } else if (documents && Array.isArray(documents)) {
      parts.push(...documents.map((doc: any) => ({ inlineData: { data: doc.base64Data, mimeType: doc.mimeType } })));
    } else if (base64Data && mimeType) {
      parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
    }

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: model || "gemini-3.1-flash-lite",
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vocabulary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    pos: { type: Type.STRING },
                    meaning: { type: Type.STRING },
                    mnemonic: { type: Type.STRING },
                    additional: { type: Type.STRING },
                    synonyms: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    antonyms: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    example: { type: Type.STRING },
                  },
                },
              },
              idioms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "ONLY the idiom phrase itself. Do NOT include the meaning or hyphen/colon." },
                    meaning: { type: Type.STRING, description: "The explanation or definition of the phrase." },
                    example: { type: Type.STRING, description: "An example sentence if available." },
                  },
                },
              },
              phrasalVerbs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "ONLY the phrasal verb itself. Do NOT include the meaning." },
                    meaning: { type: Type.STRING, description: "The explanation or definition of the phrasal verb." },
                    example: { type: Type.STRING, description: "An example sentence if available." },
                  },
                },
              },
              oneWordSubstitutions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING, description: "ONLY the one word substitution term. Do NOT include its meaning." },
                    meaning: { type: Type.STRING, description: "The explanation or definition." },
                    example: { type: Type.STRING, description: "An example sentence if available." },
                  },
                },
              },
            },
          },
        },
      }),
    );

    // Safely extract JSON in case the LLM wrapped it in markdown
    const responseText = response.text || "{}";
    const cleanText = responseText
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();
    const match = cleanText.match(/\{[\s\S]*\}/);
    const finalJSON = match ? match[0] : cleanText;
    console.log("Raw LLM text:", responseText);
    console.log("Parsed JSON:", finalJSON);
    res.json(JSON.parse(finalJSON));
  } catch (error: any) {
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

export default app;
