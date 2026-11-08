import express from "express";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import admin from "firebase-admin";
import {
  fetchWithRetry,
  resolveGeminiProxyConfig,
  formatGeminiError,
} from "../utils/backendHelpers.js";

const router = express.Router();

function getFastExtractionThinkingConfig(modelName: string): Record<string, any> | undefined {
  const m = (modelName || "").toLowerCase();
  if (m.includes("2.5")) {
    return { thinkingBudget: 0 };
  }
  if (m.startsWith("gemini-3") || m.startsWith("gemini-4")) {
    if (m.includes("lite")) {
      return { thinkingLevel: ThinkingLevel.MINIMAL };
    }
    return { thinkingLevel: ThinkingLevel.LOW };
  }
  return undefined;
}

const SUBJECT_SYNONYM_HINTS: Record<string, string> = {
  quant: "Quantitative Aptitude, Numerical Ability, Quant, Data Analysis & Interpretation, Data Interpretation, QA, Mathematical Abilities",
  reasoning: "Reasoning Ability, Reasoning, Logical Reasoning, Reasoning & Computer Aptitude, General Intelligence & Reasoning, GI",
  english: "English Language, General English, English, Verbal Ability, English Comprehension",
  ga: "General Awareness, General/Financial Awareness, General Economy & Banking Awareness, Banking Awareness, Financial Awareness, GA, Current Affairs, Static GK",
  computer: "Computer Knowledge, Computer Aptitude, Computer Awareness, Computer Proficiency",
  hindi: "Hindi Language, General Hindi, Vyavaharik Hindi",
};

// API route for Gemini extraction - Mock Announcement
router.post("/api/extract-mock", async (req, res) => {
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
      return res.status(403).json({
        error: "Forbidden: Invalid token. " + (authErr?.message || ""),
      });
    }

    const { images } = req.body;
    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "mock_score_extractor");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

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

    const thinkingConfig = getFastExtractionThinkingConfig(modelToUse);

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
        contents: contents,
        config: {
          ...(thinkingConfig ? { thinkingConfig } : {}),
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
            required: ["examType", "examRole", "examPhase", "examScope", "mockName", "platform"],
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
router.post("/api/extract-scorecard", async (req, res) => {
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
      return res.status(403).json({
        error: "Forbidden: Invalid token. " + (authErr?.message || ""),
      });
    }

    const { images, subjects } = req.body;
    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "mock_score_extractor");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

    const isDynamic =
      subjects && Array.isArray(subjects) && subjects.length > 0;
    const subjectItems: { id: string; name: string; synonyms: string }[] = isDynamic
      ? subjects.map((s: any) => {
          const key = String(s.id || "").toLowerCase();
          const nameLower = String(s.name || "").toLowerCase();
          let syn = SUBJECT_SYNONYM_HINTS[key] || "";
          if (!syn) {
            if (nameLower.includes("quant") || nameLower.includes("math") || nameLower.includes("num")) syn = SUBJECT_SYNONYM_HINTS.quant;
            else if (nameLower.includes("reason") || nameLower.includes("intell")) syn = SUBJECT_SYNONYM_HINTS.reasoning;
            else if (nameLower.includes("eng") || nameLower.includes("verbal")) syn = SUBJECT_SYNONYM_HINTS.english;
            else if (nameLower.includes("general") || nameLower.includes("aware") || nameLower.includes("ga") || nameLower.includes("gk")) syn = SUBJECT_SYNONYM_HINTS.ga;
            else if (nameLower.includes("comp")) syn = SUBJECT_SYNONYM_HINTS.computer;
          }
          return { id: s.id, name: s.name, synonyms: syn };
        })
      : [
          { id: "quant", name: "Quant", synonyms: SUBJECT_SYNONYM_HINTS.quant },
          { id: "reasoning", name: "Reasoning", synonyms: SUBJECT_SYNONYM_HINTS.reasoning },
          { id: "english", name: "English", synonyms: SUBJECT_SYNONYM_HINTS.english },
          { id: "ga", name: "GA", synonyms: SUBJECT_SYNONYM_HINTS.ga },
          { id: "computer", name: "Computer", synonyms: SUBJECT_SYNONYM_HINTS.computer },
        ];

    const subjectListStr = subjectItems
      .map((s) => `- Key "${s.id}" (${s.name})${s.synonyms ? ` — matches labels like: ${s.synonyms}` : ""}`)
      .join("\n      ");

    const prompt = `
      You are a high-precision OCR extractor for Indian competitive exam mock scorecards (Guidely, Testbook, Oliveboard, PracticeMock, Smartkeeda, Adda247, Entri, etc.).
      Carefully inspect EVERY region of ALL uploaded image(s) — including top headers, breadcrumbs, summary cards, and every row/column of sectional tables — and extract the complete scorecard data.

      CRITICAL EXTRACTION RULES:
      1. STRICT ANTI-HALLUCINATION FOR EXAM, ROLE & MOCK NAME:
         - examType: Extract ONLY if a specific exam conducting body ('SBI', 'IBPS', 'RRB', 'RBI', 'LIC', 'NIACL', 'SSC', 'CAT', etc.) is EXPLICITLY written in the image. DO NOT GUESS 'IBPS' or any default exam if no exam name is printed! If not explicitly visible, return "". (Note: If "IBPS RRB" is written, return 'RRB').
         - examRole: Extract ONLY if a specific post/role ('PO', 'Clerk', 'SO', 'AO', 'Assistant', 'Scale I', etc.) is EXPLICITLY written in the image. DO NOT GUESS 'PO' or 'Clerk' if no role is printed! If not explicitly visible, return "".
         - mockName: Extract ONLY if a real test title/number (e.g., 'Mock Test 1', 'Full Test 3', 'SBI Clerk Mains Mock 2', 'Live Mock 1') is EXPLICITLY written in the image.
           NEVER use generic website UI headings, table titles, or category dropdowns as mockName! Specifically, NEVER return strings like "Section Wise Performance", "Banking & Insurance", "Your Overall Performance", "Rank & Percentile Analysis", "Toppers Benchmark", "Overall Performance", "Scorecard", or "Performance Analysis". If no real mock title is printed in the image, return "".
           If examScope is 'Sectional', remove the subject prefix from mockName (e.g., "Numerical Ability Sectional Test 1" -> "Sectional Test 1").
         - platform: Detect from logos, fonts, colors, or URLs ('Guidely', 'Testbook', 'Oliveboard', 'PracticeMock', 'Smartkeeda', 'Adda247').

      2. DETERMINISTIC PHASE ('Mains' vs 'Prelims') & SCOPE ('Full' vs 'Sectional'):
         - examPhase MUST be 'Mains' if ANY of the following is true:
           (a) The word "Mains" is visible anywhere.
           (b) A General/Financial/Banking Awareness (ga) row OR Computer (computer) row is present in the sectional table.
           (c) There are 4 or more sections in the breakdown table.
           (d) Total Marks is greater than 100 (e.g., "Total Marks is 200", "/ 200", or section maximum marks sum to > 100 like 50 + 40 + 50 + 60 = 200).
           Otherwise, if it has 3 sections (English, Quant, Reasoning) totaling 100 marks (or 2 sections totaling 80 marks), return 'Prelims'.
         - examScope: 'Full' or 'Sectional'. If only a single subject is tested, set examScope to 'Sectional' and set detectedSubject to that subject's key.

      3. CRITICAL TABLE COLUMN DISAMBIGUATION (DO NOT CONFUSE 'ANSWERED' WITH 'SCORE', AND DO NOT SWAP 'ACCURACY' WITH 'PERCENTILE'):
         - Scorecards (especially Guidely, Testbook, PracticeMock) have multiple columns in each row. On Guidely, the rightmost 3 columns from LEFT to RIGHT are:
           (Column A) "Score (Obtained)" (e.g. "-0.25 / 50", "22 / 40", "20.75 / 50", "30.9 / 60")
           (Column B) "Accuracy (%)" (e.g. "0", "75", "95", "96" — ALSO explicitly repeated in the colored sub-bar below each row next to the target icon as "ACCURACY 0%", "ACCURACY 75%", "ACCURACY 95%", "ACCURACY 96%")
           (Column C - Far Right Circular Ring) "Performance (Percentile)" (e.g. "1.45%", "86.97%", "87.27%", "92.23%" printed inside a circular ring on the far right).
         - NEVER extract the sectional score from "Answered (Only Answered)" or "Effective Attempts"! Always read score from "Score (Obtained)".
         - NEVER swap "accuracy" and "percentile"!
           * Even though Guidely prints a "%" sign inside the far-right circular ring (like "87.27%" or "92.23%"), that far-right circular ring is under "Performance (Percentile)" and MUST go into "percentile"!
           * The middle value under "Accuracy (%)" (which matches the "ACCURACY X%" text next to Correct/Wrong in the colored sub-box, e.g. "0", "75", "95", "96") MUST go into "accuracy"!

      4. NUMERIC VALUES, NEGATIVE SCORES & OVERALL METRICS:
         - Extract ONLY the numerator from "X / Y" scores (e.g., "27.3 / 60" -> "27.3", "-0.25 / 50" -> "-0.25", "0 / 50" -> "0", "73.4 / 100" -> "73.4").
         - PRESERVE NEGATIVE SIGNS: Look carefully for a minus sign ("-" or "−") before any score (especially when Correct is 0 and Wrong > 0, such as "-0.25 / 50" or "-1 / 50"). Always output "-0.25" (with the minus sign), NEVER round or change a negative score to "0"!
         - Overall Score & Overall Percentile (MANDATORY WHEN VISIBLE):
           * "score": Extract from the "YOUR SCORE" / "Overall Score" card (e.g., "73.4 / 100" -> "73.4", "62.3 / 100" -> "62.3").
           * "percentile": ALWAYS extract from the "YOUR PERCENTILE" / "Overall Percentile" card (e.g., "86.31%ile" -> "86.31", "78.48%ile" -> "78.48"). Strip "%ile" or "%". NEVER leave "percentile" empty when a percentile card is visible!
           * "accuracy": Extract if an overall accuracy percentage is printed in the summary cards; otherwise return "".
         - Sectional Breakdown (MANDATORY — CHECK EVERY ROW INCLUDING GA):
           Map each section row in the image to one of the subject keys below using the synonyms:
      ${subjectListStr}
           For EVERY visible subject row, extract:
           * "score": the numerator from "Score (Obtained)" (including negative scores like "-0.25" or zero scores like "0")
           * "accuracy": the number from "Accuracy (%)" / "ACCURACY X%"
           * "percentile": the number from the far-right "Performance (Percentile)" circular ring
           * "correct": the integer next to the green checkmark "Correct" (in the sub-box below the section name, e.g. "0", "24", "21", "26" — DO NOT use "Answered (Only Answered)"!)
           * "wrong": the integer next to the red cross "Wrong" (in the sub-box below the section name, e.g. "1", "8", "1", "1")
    `;

    const contents: any[] = [{ text: prompt }];
    for (const img of images) {
      contents.push({
        inlineData: { data: img.base64, mimeType: img.mimeType },
      });
    }

    const thinkingConfig = getFastExtractionThinkingConfig(modelToUse);

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
        contents: contents,
        config: {
          ...(thinkingConfig ? { thinkingConfig } : {}),
          responseMimeType: "application/json",
          responseSchema: (() => {
            const requiredTopLevel = [
              "examType",
              "examRole",
              "examPhase",
              "examScope",
              "mockName",
              "platform",
              "detectedSubject",
              "date",
              "score",
              "percentile",
              "percentage",
              "accuracy",
              ...subjectItems.map((s) => s.id),
            ];

            const schemaObj: any = {
              type: Type.OBJECT,
              properties: {
                examType: {
                  type: Type.STRING,
                  description:
                    "Explicitly printed exam name (e.g. SBI, IBPS, RRB, RBI, LIC, SSC). Return empty string if not explicitly written in the image — NEVER guess.",
                },
                examRole: {
                  type: Type.STRING,
                  description:
                    "Explicitly printed role (e.g. PO, Clerk, AO, SO, Assistant). Return empty string if not explicitly written in the image — NEVER guess.",
                },
                examPhase: {
                  type: Type.STRING,
                  description:
                    "Mains if GA/Computer section exists, 4+ sections exist, or Total Marks > 100 (e.g. 200). Otherwise Prelims.",
                },
                examScope: {
                  type: Type.STRING,
                  description: "Full or Sectional",
                },
                mockName: {
                  type: Type.STRING,
                  description:
                    "Explicit mock test name (e.g. Mock Test 1). Return empty string if not shown — NEVER use UI headers like 'Section Wise Performance' or 'Banking & Insurance'.",
                },
                platform: {
                  type: Type.STRING,
                  description:
                    "Platform name like Guidely, Testbook, PracticeMock, Oliveboard, Smartkeeda, Adda247",
                },
                detectedSubject: {
                  type: Type.STRING,
                  description:
                    "If sectional, the matching subject key. Otherwise empty string",
                },
                date: {
                  type: Type.STRING,
                  description: "Date of the mock in YYYY-MM-DD if visible, else empty string",
                },
                score: {
                  type: Type.STRING,
                  description: "Overall score numerator only (from 'YOUR SCORE'). E.g. 73.4 / 100 -> 73.4",
                },
                percentile: {
                  type: Type.STRING,
                  description: "Overall percentile (from 'YOUR PERCENTILE', 0-100). Strip '%ile' or '%', e.g. '86.31%ile' -> '86.31'. Mandatory when visible.",
                },
                percentage: { type: Type.STRING, description: "Overall percentage (0-100) if explicitly labeled 'Percentage', else empty string" },
                accuracy: {
                  type: Type.STRING,
                  description:
                    "Explicitly printed overall accuracy (0-100), or empty string if not printed in the bottom summary cards.",
                },
              },
              required: requiredTopLevel,
            };

            subjectItems.forEach((s) => {
              schemaObj.properties[s.id] = {
                type: Type.OBJECT,
                description: `Sectional stats for ${s.name} (${s.synonyms || s.id}). Follow the table columns left-to-right: 1st 'Score (Obtained)' -> score, 2nd 'Accuracy (%)' -> accuracy, 3rd far-right circular ring 'Performance (Percentile)' -> percentile, plus green 'Correct' and red 'Wrong' counts.`,
                properties: {
                  score: {
                    type: Type.STRING,
                    description: `Score numerator for ${s.name} from 'Score (Obtained)' column (preserve minus sign if negative, e.g. -0.25/50 -> -0.25, 20.75/50 -> 20.75).`,
                  },
                  accuracy: {
                    type: Type.STRING,
                    description: `Accuracy for ${s.name} from the 'Accuracy (%)' column or 'ACCURACY X%' badge next to Correct/Wrong (e.g. 0, 75, 95, 96). Do NOT put the far-right circular ring value here.`,
                  },
                  percentile: {
                    type: Type.STRING,
                    description: `Percentile for ${s.name} from the far-right 'Performance (Percentile)' column / circular ring (e.g. 1.45, 86.97, 87.27, 92.23).`,
                  },
                  correct: {
                    type: Type.STRING,
                    description: `Integer next to green 'Correct' label for ${s.name} (e.g. 0, 24, 21, 26 — NOT 'Answered').`,
                  },
                  wrong: {
                    type: Type.STRING,
                    description: `Integer next to red 'Wrong' label for ${s.name} (e.g. 1, 8, 1, 1).`,
                  },
                },
                propertyOrdering: ["score", "accuracy", "percentile", "correct", "wrong"],
                required: ["score", "accuracy", "percentile", "correct", "wrong"],
              };
            });

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

router.post("/api/generate-word-details", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token);

    const { word } = req.body;
    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "flashcards");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

    const prompt = `Provide the English meaning and a helpful mnemonic (trick to remember) for the word "${word}". Return ONLY a JSON object: {"meaning": "...", "mnemonic": "..."}`;

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
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

router.post("/api/extract-document", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token);

    const { documents, base64Data, mimeType, textData } = req.body;
    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "flashcards");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;
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

CRITICAL INSTRUCTIONS FOR ONE WORD SUBSTITUTIONS, IDIOMS & PHRASAL VERBS:
- If a section in the document is explicitly titled "One-word substitutes", "One Word Substitutions", "OWS", or similar (even if the title also contains the word "VOCABULARY", like "One-word substitutes: VOCABULARY"), YOU MUST extract ALL items within that section into the 'oneWordSubstitutions' array.
- DO NOT place them in the 'vocabulary' array, even if they are single words!
- For idioms, phrasal verbs, and one-word substitutions, strictly separate 'text' (only the phrase or word itself without the meaning), 'meaning' (the explanation or definition), and 'example' (if an example sentence is provided).
- Format handling: Items often look like "1. Phrase (5) – Meaning spanning multiple lines. Example: Sentence."
- The 'text' MUST ONLY contain the actual phrase/word (e.g. "Knell"). Remove leading numbers (e.g. "1.") and parenthetical numbers (e.g. "(5)").
- The 'meaning' MUST contain the full definition (e.g. "The sound of a bell announcing death or a funeral."). Combine any multi-line text into a single string. Never leave it empty if a definition exists! Do NOT put the definition into the 'text' field of a new object.
- The 'example' MUST contain the example sentence.

Return ONLY structured JSON adhering to this schema. If a field or category is not present, return an empty array or empty string.`;

    const parts: any[] = [{ text: prompt }];

    if (textData) {
      parts[0].text =
        prompt + "\n\n--- SOURCE TEXT TO EXTRACT FROM ---\n" + textData;
    } else if (documents && Array.isArray(documents)) {
      parts.push(
        ...documents.map((doc: any) => ({
          inlineData: { data: doc.base64Data, mimeType: doc.mimeType },
        })),
      );
    } else if (base64Data && mimeType) {
      parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
    }

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
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
                    text: {
                      type: Type.STRING,
                      description:
                        "ONLY the idiom phrase itself. Do NOT include the meaning or hyphen/colon.",
                    },
                    meaning: {
                      type: Type.STRING,
                      description:
                        "The explanation or definition of the phrase.",
                    },
                    example: {
                      type: Type.STRING,
                      description: "An example sentence if available.",
                    },
                  },
                },
              },
              phrasalVerbs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: {
                      type: Type.STRING,
                      description:
                        "ONLY the phrasal verb itself. Do NOT include the meaning.",
                    },
                    meaning: {
                      type: Type.STRING,
                      description:
                        "The explanation or definition of the phrasal verb.",
                    },
                    example: {
                      type: Type.STRING,
                      description: "An example sentence if available.",
                    },
                  },
                },
              },
              oneWordSubstitutions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: {
                      type: Type.STRING,
                      description:
                        "ONLY the one word substitution term. Do NOT include its meaning.",
                    },
                    meaning: {
                      type: Type.STRING,
                      description: "The explanation or definition.",
                    },
                    example: {
                      type: Type.STRING,
                      description: "An example sentence if available.",
                    },
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

router.post("/api/extract-raw-text", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token);

    const { documents, base64Data, mimeType } = req.body;
    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "flashcards");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;
    const prompt = `You are a verbatim OCR and document transcription engine.
Transcribe and extract ALL visible textual content, editorial analysis, vocabulary words, idioms, sentences, and notes from the attached document/image exactly as written.
Preserve readability, paragraphs, and list structure. Do not summarize or omit anything.`;

    const parts: any[] = [{ text: prompt }];

    if (documents && Array.isArray(documents)) {
      parts.push(
        ...documents.map((doc: any) => ({
          inlineData: { data: doc.base64Data, mimeType: doc.mimeType },
        })),
      );
    } else if (base64Data && mimeType) {
      parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
    } else {
      return res.status(400).json({ error: "No document or image provided for OCR extraction." });
    }

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
        contents: [
          {
            role: "user",
            parts,
          },
        ],
      })
    );

    const rawText = response.text || "";
    res.json({ rawText });
  } catch (error: any) {
    res.status(500).json({ error: formatGeminiError(error) });
  }
});

// YouTube Transcript Extraction API via TranscriptAPI
function extractYouTubeVideoId(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  // Direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  // Regex for various YouTube URL patterns
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i
  );
  return match ? match[1] : null;
}

router.post(["/api/youtube/transcript", "/api/youtube-transcript"], async (req, res) => {
  try {
    const rawUrl = req.body?.url || req.body?.videoUrl || req.body?.video_url;
    const startTimeSec = req.body?.startTimeSec;
    const endTimeSec = req.body?.endTimeSec;
    const includeTimestamps = req.body?.includeTimestamps;

    if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
      return res.status(400).json({
        success: false,
        error: "Invalid YouTube URL or video is private/unlisted. Please check the link and try again.",
      });
    }

    const videoId = extractYouTubeVideoId(rawUrl);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: "Invalid YouTube URL or video is private/unlisted. Please provide a valid public YouTube link.",
      });
    }

    const apiKey = process.env.TRANSCRIPT_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "TRANSCRIPT_API_KEY is not configured in environment variables. Please add it to your project settings.",
      });
    }

    // Call TranscriptAPI
    const apiUrl = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(
      videoId
    )}&send_metadata=true`;

    let response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    // Fallback attempt to v1 if v2 returns 404 or path variant
    if (!response.ok && response.status === 404) {
      const fallbackUrl = `https://transcriptapi.com/api/v1/transcript?video_id=${encodeURIComponent(
        videoId
      )}&send_metadata=true`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });
      if (fallbackRes.ok) {
        response = fallbackRes;
      }
    }

    if (!response.ok) {
      const status = response.status;
      let errorData: any = {};
      try {
        const text = await response.text();
        errorData = JSON.parse(text);
      } catch {
        errorData = { error: `HTTP ${status}` };
      }

      const errorMessage =
        errorData?.message ||
        errorData?.error ||
        errorData?.detail ||
        `TranscriptAPI responded with HTTP status ${status}`;

      if (status === 401 || status === 403) {
        return res.status(status).json({
          success: false,
          error: "Invalid or expired TRANSCRIPT_API_KEY. Please verify your API key in project settings.",
          details: errorMessage,
        });
      }

      if (status === 402 || status === 429) {
        return res.status(429).json({
          success: false,
          error: "Transcript API credit limit reached. Check API key in settings or top up credits on TranscriptAPI.",
          details: errorMessage,
        });
      }

      if (status === 404) {
        return res.status(404).json({
          success: false,
          error: "No transcript available for this video. Subtitles or auto-generated captions are not enabled for this video.",
          allowManualInput: true,
          details: errorMessage,
        });
      }

      return res.status(status).json({
        success: false,
        error: `Failed to retrieve video transcript: ${errorMessage}`,
        details: errorData,
      });
    }

    let data: any = {};
    try {
      const rawBody = await response.text();
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      console.warn("Failed to parse TranscriptAPI response JSON:", parseErr);
      data = {};
    }

    // Normalizing transcript segments across possible TranscriptAPI response shapes
    let rawSegments: Array<{ start: number; duration: number; text: string }> = [];
    if (Array.isArray(data?.transcript)) {
      rawSegments = data.transcript;
    } else if (Array.isArray(data?.segments)) {
      rawSegments = data.segments;
    } else if (Array.isArray(data?.data)) {
      rawSegments = data.data;
    } else if (Array.isArray(data)) {
      rawSegments = data;
    }

    const parsedSegments = rawSegments
      .map((seg: any) => ({
        start: typeof seg.start === "number" ? seg.start : parseFloat(seg.start || "0") || 0,
        duration: typeof seg.duration === "number" ? seg.duration : parseFloat(seg.duration || "0") || 0,
        text: (seg.text || "").trim(),
      }))
      .filter((seg) => seg.text.length > 0);

    if (parsedSegments.length === 0 && typeof data?.text === "string" && data.text.trim()) {
      parsedSegments.push({
        start: 0,
        duration: 0,
        text: data.text.trim(),
      });
    }

    if (parsedSegments.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No transcript available for this video. The returned captions were empty.",
        allowManualInput: true,
      });
    }

    const totalDurationSec = Math.max(...parsedSegments.map((s) => s.start + s.duration));

    // Time-range filtering with automatic clamping
    let startSec = typeof startTimeSec === "number" && !isNaN(startTimeSec) && startTimeSec >= 0
      ? startTimeSec
      : 0;
    let endSec = typeof endTimeSec === "number" && !isNaN(endTimeSec) && endTimeSec > 0
      ? endTimeSec
      : totalDurationSec;

    // Automatic clamping logic
    let isClamped = false;
    if (startSec >= totalDurationSec) {
      startSec = 0;
      isClamped = true;
    }
    if (endSec > totalDurationSec) {
      endSec = totalDurationSec;
      isClamped = true;
    }

    const filteredSegments = parsedSegments.filter((seg) => {
      const segStart = seg.start;
      return segStart >= startSec && segStart <= endSec;
    });

    const finalSegments = filteredSegments.length > 0 ? filteredSegments : parsedSegments;

    let fullText = finalSegments
      .map((s) => (includeTimestamps ? `[${Math.floor(s.start / 60)}:${Math.floor(s.start % 60).toString().padStart(2, "0")}] ${s.text}` : s.text))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    // Handling very long videos (> 30,000 words / ~150,000 chars)
    let isTruncated = false;
    const wordCount = fullText.split(/\s+/).length;
    if (wordCount > 30000) {
      const words = fullText.split(/\s+/).slice(0, 30000);
      fullText = words.join(" ") + "... [Transcript truncated at 30,000 words for optimal AI analysis]";
      isTruncated = true;
    }

    const extractedDurationSec = finalSegments.length > 0
      ? Math.max(...finalSegments.map((s) => s.start + s.duration)) - Math.min(...finalSegments.map((s) => s.start))
      : totalDurationSec;

    const videoTitle = data?.metadata?.title || data?.title || `YouTube Video (${videoId})`;
    const channelTitle = data?.metadata?.author || data?.metadata?.channel || data?.author || data?.channelTitle;

    return res.json({
      success: true,
      videoId,
      videoTitle,
      channelTitle,
      totalDurationSec: Math.round(totalDurationSec),
      extractedDurationSec: Math.round(extractedDurationSec),
      clampedStartSec: startSec,
      clampedEndSec: endSec,
      isClamped,
      isTruncated,
      wordCount,
      segmentCount: finalSegments.length,
      fullText,
      segments: finalSegments,
    });
  } catch (error: any) {
    console.error("Error in /api/youtube/transcript:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred while extracting the YouTube transcript.",
    });
  }
});

// Endpoint for extracting structured editorial vocabulary from any source text/transcript using Gemini
router.post("/api/extract-editorial-vocab", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];
    await admin.auth().verifyIdToken(token);

    const { textBody, transcript, customInstructions, context, videoContext, targetLevel, wordCount, nativeLanguage } = req.body;
    const sourceText = (typeof textBody === "string" && textBody.trim()) 
      ? textBody.trim() 
      : (typeof transcript === "string" && transcript.trim()) 
      ? transcript.trim() 
      : "";

    if (!sourceText) {
      return res.status(400).json({ error: "Text content (textBody or transcript) is required for vocabulary extraction." });
    }

    let proxyRes;
    try {
      proxyRes = await resolveGeminiProxyConfig(req.body, req.headers, "flashcards");
    } catch (proxyErr: any) {
      return res.status(proxyErr.status || 403).json({ error: proxyErr.message || String(proxyErr) });
    }

    const aiClient = proxyRes.aiClient;
    const modelToUse = proxyRes.model;

    // Standardized context resolution (supports string context or object context)
    let contextStr = "";
    if (typeof context === "string" && context.trim()) {
      contextStr = `\nSource Context / Metadata: ${context.trim()}`;
    } else if (context && typeof context === "object") {
      contextStr = `\nSource Context: ${JSON.stringify(context)}`;
    } else if (videoContext && typeof videoContext === "object") {
      const titleContext = videoContext.title ? `Title: "${videoContext.title}" ` : "";
      const channelContext = videoContext.channel ? `Channel/Author: "${videoContext.channel}"` : "";
      contextStr = `\nSource Context: ${titleContext}${channelContext}`.trim();
    }

    let systemPrompt = "";
    const isCustomInstruction = Boolean(customInstructions && typeof customInstructions === "string" && customInstructions.trim());

    if (isCustomInstruction) {
      systemPrompt = `${customInstructions.trim()}${contextStr ? `\n\nSOURCE CONTEXT METADATA:\n${contextStr}` : ""}`;
    } else {
      const targetLevelStr = typeof targetLevel === "string" && targetLevel.trim() ? targetLevel.trim() : "B2";
      const wordCountNum = typeof wordCount === "number" && wordCount > 0 ? wordCount : 15;
      const nativeLangStr = typeof nativeLanguage === "string" && nativeLanguage.trim() ? nativeLanguage.trim() : "English";

      systemPrompt = `You are a specialized Vocabulary and Language Extraction Assistant.
Extract core high-value vocabulary words from the provided source content at a ${targetLevelStr} level (${wordCountNum} words).
Provide clear definitions and contextual meanings in English.

Structure every response exactly according to the following layout guide:

#### **Core Vocabularies & Additional Words**

* **[Word] ([Part of Speech in Title Case])**
    * **Meaning:** [Core meaning / definition]
    * **Synonyms:** [Comma-separated synonyms]
    * **Antonyms:** [Comma-separated antonyms]
    * **Additional:**
        ([theme descriptor]): [Comma-separated list of related terms, idioms, or phrasal verbs]
    * **Example:** [Example sentence]`;
    }

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\nTRANSCRIPT / SOURCE CONTENT:\n${sourceText}`,
          },
        ],
      },
    ];

    const response = await fetchWithRetry(() =>
      aiClient.models.generateContent({
        model: modelToUse,
        contents,
      })
    );

    const rawOutputText = response.text || "";
    const cleanText = rawOutputText
      .replace(/^```markdown\s*/gi, "")
      .replace(/^```\s*/gi, "")
      .replace(/\s*```$/gi, "")
      .trim();

    // Parse the Markdown into structured words
    const lines = cleanText.split("\n");
    const words: Array<any> = [];
    let headerTitle = "Core Vocabularies & Additional Words";

    let currentWord: any = null;
    let currentField: "meaning" | "synonyms" | "antonyms" | "additional" | "example" | null = null;
    const additionalLines: string[] = [];

    const finalizeWord = () => {
      if (currentWord && currentWord.word) {
        if (additionalLines.length > 0) {
          currentWord.additional = additionalLines.join("\n").trim();
          currentWord.editorialContext = currentWord.additional;
        }
        words.push({
          word: currentWord.word.trim(),
          pos: currentWord.pos?.trim() || "Noun",
          meaning: currentWord.meaning?.trim() || "",
          synonyms: currentWord.synonyms || [],
          antonyms: currentWord.antonyms || [],
          additional: currentWord.additional || "",
          editorialContext: currentWord.editorialContext || "",
          example: currentWord.example?.trim() || "",
          mnemonic: "",
        });
      }
      currentWord = null;
      currentField = null;
      additionalLines.length = 0;
    };

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;

      if (/^#+\s*(\*\*)?Core Vocabularies/i.test(trimmed) || /^Core Vocabularies/i.test(trimmed)) {
        headerTitle = trimmed.replace(/^[#*\s]+|[#*\s]+$/g, "").trim();
        continue;
      }

      // Match Word Header: e.g. "* **Debilitating (Adjective)**" or "**Debilitating (Adjective)**" or "Debilitating (Adjective)"
      const wordHeaderMatch = trimmed.match(
        /^(?:\*|\-)?\s*(?:\*\*)?([A-Za-z\s\-']+?)\s*\(([^)]+)\)(?:\*\*)?\s*$/
      );
      const isFieldStart = /^(?:\*|\-)?\s*(?:\*\*)?(Meaning|Synonyms|Antonyms|Additional|Example):/i.test(trimmed);

      if (wordHeaderMatch && !isFieldStart && !/^\s*\([^)]+\):/.test(trimmed)) {
        finalizeWord();
        currentWord = {
          word: wordHeaderMatch[1].replace(/\*\*/g, "").trim(),
          pos: wordHeaderMatch[2].replace(/\*\*/g, "").trim(),
          synonyms: [],
          antonyms: [],
        };
        continue;
      }

      if (currentWord) {
        const meaningMatch = trimmed.match(/^(?:\*|\-)?\s*(?:\*\*)?Meaning(?:\*\*)?\s*:\s*(.+)$/i);
        if (meaningMatch) {
          currentField = "meaning";
          currentWord.meaning = meaningMatch[1].replace(/^\*\*|\*\*$/g, "").trim();
          continue;
        }

        const synMatch = trimmed.match(/^(?:\*|\-)?\s*(?:\*\*)?Synonyms(?:\*\*)?\s*:\s*(.*)$/i);
        if (synMatch) {
          currentField = "synonyms";
          const synStr = synMatch[1].replace(/^\*\*|\*\*$/g, "").trim();
          currentWord.synonyms = synStr ? synStr.split(",").map((s: string) => s.trim().replace(/^\*\*|\*\*$/g, "")).filter(Boolean) : [];
          continue;
        }

        const antMatch = trimmed.match(/^(?:\*|\-)?\s*(?:\*\*)?Antonyms(?:\*\*)?\s*:\s*(.*)$/i);
        if (antMatch) {
          currentField = "antonyms";
          const antStr = antMatch[1].replace(/^\*\*|\*\*$/g, "").trim();
          currentWord.antonyms = antStr ? antStr.split(",").map((s: string) => s.trim().replace(/^\*\*|\*\*$/g, "")).filter(Boolean) : [];
          continue;
        }

        const addMatch = trimmed.match(/^(?:\*|\-)?\s*(?:\*\*)?Additional(?:\*\*)?\s*:\s*(.*)$/i);
        if (addMatch) {
          currentField = "additional";
          const inlineContent = addMatch[1].replace(/^\*\*|\*\*$/g, "").trim();
          if (inlineContent) additionalLines.push(inlineContent);
          continue;
        }

        const exMatch = trimmed.match(/^(?:\*|\-)?\s*(?:\*\*)?Example(?:\*\*)?\s*:\s*(.+)$/i);
        if (exMatch) {
          currentField = "example";
          currentWord.example = exMatch[1].replace(/^\*\*|\*\*$/g, "").trim();
          continue;
        }

        if (currentField === "additional" || /^\s*\([^)]+\):/.test(trimmed)) {
          additionalLines.push(trimmed);
          continue;
        }

        if (currentField === "meaning" && currentWord.meaning) {
          currentWord.meaning += " " + trimmed;
          continue;
        }

        if (currentField === "example" && currentWord.example) {
          currentWord.example += " " + trimmed;
          continue;
        }
      }
    }

    finalizeWord();

    return res.json({
      title: headerTitle || "Core Vocabularies & Additional Words",
      topic: "English & Editorial Analysis",
      rawMarkdown: cleanText,
      words: words,
      idiomsAndPhrases: [],
    });
  } catch (error: any) {
    console.error("Error in /api/extract-editorial-vocab:", error);
    return res.status(500).json({ error: formatGeminiError(error) });
  }
});

// =========================================================================
// AI Vocab Quiz Generator - Dynamic Prompt Engineering & Endpoint
// =========================================================================

interface QuizWordInputItem {
  id?: string;
  word: string;
  meaning?: string;
  pos?: string;
  synonyms?: string[];
  antonyms?: string[];
  example?: string;
}

interface QuizPromptBuildOptions {
  format?: string;
  theme?: string;
  scope?: "strict" | "expanded";
  questionCount?: number;
  words: QuizWordInputItem[];
}

function constructDynamicQuizPrompt(config: QuizPromptBuildOptions): string {
  const requestedCount = Math.max(3, Math.min(20, Number(config.questionCount) || 5));
  const targetCount =
    config.scope === "strict"
      ? Math.min(requestedCount, Math.max(3, config.words.length))
      : requestedCount;

  // 1. The Base
  const baseSection = `You are an expert English examiner for competitive banking and government exams. Create a vocabulary quiz with ${targetCount} questions in strict JSON format based on the following JSON schema:
{
  "quizTitle": "A concise, engaging title for this quiz",
  "passageText": "The cohesive passage text (REQUIRED when format is 'cloze' or 'reading_comprehension')",
  "questions": [
    {
      "id": "q1",
      "questionText": "The question prompt or Blank identifier (e.g. Blank 1)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "testedWord": "The target vocabulary word tested",
      "explanation": "Provide a clear, exam-focused 1-2 sentence explanation for why the correct option fits and why alternatives fail.",
      "sentenceChunks": ["Chunk 1", "Chunk 2", "Chunk 3", "Chunk 4"]
    }
  ]
}`;

  // 2. Injecting the Words
  const wordEntries = config.words.slice(0, 20).map((w, idx) => {
    const details = [
      `${idx + 1}. Word: "${w.word}"`,
      w.pos ? `(${w.pos})` : "",
      w.meaning ? `- Meaning: ${w.meaning}` : "",
      w.synonyms && w.synonyms.length > 0 ? `| Synonyms: ${w.synonyms.join(", ")}` : "",
      w.antonyms && w.antonyms.length > 0 ? `| Antonyms: ${w.antonyms.join(", ")}` : "",
      w.example ? `| Example: "${w.example}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return details;
  });

  const wordsSection = `Here is the target vocabulary list:\n${wordEntries.join("\n")}`;

  // 3. Injecting the Scope
  const isExpanded = config.scope === "expanded";
  const scopeSection = isExpanded
    ? `Scope Directive:\nYou may use these words OR their direct, advanced synonyms/antonyms as the correct answers to test deep comprehension.`
    : `Scope Directive:\nYou MUST only use these exact target words as the correct answers (if targetCount exceeds the word list size, test additional nuances/contexts of the provided words).`;

  // 4. Injecting the Format & Theme
  const format = config.format || "cloze";
  const theme = config.theme ? String(config.theme).trim() : "";
  let formatThemeSection = "";

  if (format === "cloze") {
    formatThemeSection = `Format & Theme Directive:\nFormat the quiz as a Cloze Test with exactly ${targetCount} blanks. Write a cohesive ${
      targetCount > 8 ? "280-350" : "180-240"
    }-word passage about ${
      theme ? `[User's Theme: ${theme}]` : "a modern editorial, economic, or real-world scenario"
    }. Replace ${targetCount} vocabulary words with blanks formatted strictly as [Blank 1], [Blank 2], ..., [Blank ${targetCount}] in 'passageText'. In the 'questions' array, each corresponding blank MUST have 'questionText' as "Blank 1", "Blank 2", etc., with 4 competitive options.`;
  } else if (format === "reading_comprehension") {
    formatThemeSection = `Format & Theme Directive:\nFormat the quiz as Reading Comprehension with ${targetCount} questions. Write a cohesive 220-320 word editorial passage about ${
      theme ? `[User's Theme: ${theme}]` : "a thought-provoking economic, policy, or scientific scenario"
    } naturally weaving in the target vocabulary words. Populate 'passageText' with this full passage, and create ${targetCount} questions testing contextual meaning, inference, and vocabulary usage in the passage. Do NOT include 'sentenceChunks'.`;
  } else if (format === "fillers") {
    formatThemeSection = `Format & Theme Directive:\nFormat the quiz as Sentence Fillers. Create ${targetCount} single-sentence fill-in-the-blank questions (using '_____' for the blank in 'questionText') testing nuance and precision. ${
      theme ? `Write the sentences about [User's Theme: ${theme}].` : "Use rich, exam-standard editorial sentence contexts."
    } 'passageText' and 'sentenceChunks' should be omitted.`;
  } else if (format === "synonyms_antonyms") {
    formatThemeSection = `Format & Theme Directive:\nFormat the quiz as Synonyms & Antonyms. Create ${targetCount} questions directly testing either the closest contextual synonym or opposite antonym of the target vocabulary words (clearly state whether the question asks for a SYNONYM or ANTONYM in 'questionText'). ${
      theme ? `Frame the example contexts around [User's Theme: ${theme}].` : ""
    } 'passageText' and 'sentenceChunks' should be omitted.`;
  } else if (format === "spot_error") {
    formatThemeSection = `Format & Theme Directive:\nFormat the quiz as Spot the Error. Create ${targetCount} questions where each sentence is split into 4 distinct segments (provided in BOTH 'sentenceChunks' and 'options' as an array of 4 strings) with exactly one segment containing a lexical, contextual, or grammatical usage error involving the target vocabulary. ${
      theme ? `Center the sentences around [User's Theme: ${theme}].` : ""
    } 'passageText' should be omitted.`;
  } else {
    // mixed
    formatThemeSection = `Format & Theme Directive:\nFormat the quiz as a Mixed Mock Challenge with ${targetCount} questions combining Sentence Fillers, Synonyms/Antonyms, and Spot-the-Error questions. ${
      theme ? `Contextualize around [User's Theme: ${theme}].` : ""
    } IMPORTANT: For any Spot-the-Error question in this mix, populate 'sentenceChunks' with the 4 sentence segments (and set 'options' to those same 4 segments). For Sentence Fillers and Synonym/Antonym questions, omit 'sentenceChunks' so they render as standard 4-option MCQs.`;
  }

  // 5. Validation
  const validationSection = `Validation Directives:
- Generate ${targetCount} questions in the 'questions' array.
- Ensure 'correctAnswerIndex' (0, 1, 2, or 3) matches the 'options' array.
- Provide a clear 'explanation' for every question.
- 'options' must always be an array of 4 competitive choices.
- Output MUST be strictly valid raw JSON conforming to the schema above.`;

  return [
    baseSection,
    wordsSection,
    scopeSection,
    formatThemeSection,
    validationSection,
  ].join("\n\n");
}

const handleQuizGeneration = async (req: express.Request, res: express.Response) => {
  try {
    const { customApiKey, config } = req.body || {};
    if (!config || !Array.isArray(config.words) || config.words.length === 0) {
      return res.status(400).json({ error: "No vocabulary words provided for quiz generation." });
    }

    let aiConfig;
    try {
      aiConfig = await resolveGeminiProxyConfig(req.body, req.headers, "vocab_extractor");
    } catch (cfgErr: any) {
      try {
        aiConfig = await resolveGeminiProxyConfig(req.body, req.headers, "ai_tutor");
      } catch (nestedCfgErr: any) {
        const directKey = customApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
        if (!directKey) {
          return res.status(403).json({
            error: "Gemini API key is required. Please check your settings or server API key configuration.",
          });
        }
        aiConfig = {
          apiKey: directKey,
          model: "gemini-2.5-flash",
          isGlobalKey: false,
          featureKey: "vocab_extractor",
          aiClient: new GoogleGenAI({ apiKey: directKey }),
        };
      }
    }

    const { aiClient, model } = aiConfig;

    let wordsToUse = config.words;
    if (wordsToUse.length > 20) {
      const shuffled = [...wordsToUse];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      wordsToUse = shuffled.slice(0, 20);
    }

    const prompt = constructDynamicQuizPrompt({
      format: config.format || "cloze",
      theme: config.theme ? String(config.theme).trim() : "",
      scope: config.scope === "expanded" ? "expanded" : "strict",
      questionCount: Number(config.questionCount) || 5,
      words: wordsToUse,
    });

    // Mitigation for JSON Parsing Errors:
    // Retry wrapper attempting generation up to 2 times if JSON is malformed
    let parsedData: any = null;
    let attempts = 0;
    const maxAttempts = 2;
    let lastError: any = null;

    while (attempts < maxAttempts && !parsedData) {
      attempts++;
      try {
        const response = await fetchWithRetry(async () => {
          return await aiClient.models.generateContent({
            model: model || "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: attempts === 1 ? 0.4 : 0.2, // slightly more deterministic on retry
            },
          });
        });

        const responseText = response.text ? response.text.trim() : "";
        if (!responseText) {
          throw new Error("Empty response received from Gemini.");
        }

        try {
          parsedData = JSON.parse(responseText);
        } catch (parseErr) {
          // Clean possible markdown json codeblock fencing
          const cleanJson = responseText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
          parsedData = JSON.parse(cleanJson);
        }

        if (!parsedData || !Array.isArray(parsedData.questions) || parsedData.questions.length === 0) {
          parsedData = null;
          throw new Error("Quiz questions missing from generated output.");
        }
      } catch (err) {
        lastError = err;
        console.warn(`AI Quiz Generation attempt ${attempts} failed:`, err);
        if (attempts >= maxAttempts) {
          break;
        }
      }
    }

    if (!parsedData || !Array.isArray(parsedData.questions)) {
      return res.status(500).json({
        error: "The AI got confused, let's try again! (Please retry generating your quiz)",
      });
    }

    // Sanitize and ensure complete structure
    parsedData.questions = parsedData.questions.map((q: any, idx: number) => {
      const options = Array.isArray(q.options) && q.options.length > 0 ? q.options : ["A", "B", "C", "D"];
      const correctIndex =
        typeof q.correctAnswerIndex === "number" &&
        q.correctAnswerIndex >= 0 &&
        q.correctAnswerIndex < options.length
          ? q.correctAnswerIndex
          : 0;

      return {
        id: q.id || `q_${idx + 1}_${Date.now()}`,
        questionText: q.questionText || `Question ${idx + 1}`,
        options: options,
        correctAnswerIndex: correctIndex,
        testedWord: q.testedWord || wordsToUse[idx % wordsToUse.length]?.word || "",
        explanation: q.explanation || "Correct option accurately fits the grammatical context and vocabulary meaning.",
        sentenceChunks: Array.isArray(q.sentenceChunks) ? q.sentenceChunks : undefined,
      };
    });

    return res.json(parsedData);
  } catch (error: any) {
    console.error("Error in AI Quiz Generator:", error);
    return res.status(500).json({
      error: "The AI got confused, let's try again!",
    });
  }
};

// Register both /api/generate-quiz (Phase 3 primary) and /api/generate-vocab-quiz (seamless compatibility)
router.post("/api/generate-quiz", handleQuizGeneration);
router.post("/api/generate-vocab-quiz", handleQuizGeneration);

export default router;
