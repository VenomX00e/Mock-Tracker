import fs from 'fs';

// -- 1. Patch geminiService.ts --
let gCode = fs.readFileSync('src/services/geminiService.ts', 'utf8');
const gTarget = `export async function parseScorecardImage(images: { base64: string, mimeType: string }[]): Promise<Partial<MockScore>> {`;
const gReplacement = `export async function parseScorecardImage(images: { base64: string, mimeType: string }[], subjects?: { id: string, name: string }[]): Promise<Partial<MockScore>> {`;
gCode = gCode.replace(gTarget, gReplacement);

const fetchTarget = `    body: JSON.stringify({ images, customApiKey: customKey || null })`;
const fetchReplacement = `    body: JSON.stringify({ images, customApiKey: customKey || null, subjects })`;
gCode = gCode.replace(fetchTarget, fetchReplacement);

const retTarget = `    quant: {
      score: parsed.quant?.score != null ? Number(parsed.quant.score) : null,
      percentile: parsed.quant?.percentile != null ? Number(parsed.quant.percentile) : null,
      accuracy: parsed.quant?.accuracy != null ? Number(parsed.quant.accuracy) : null,
    },
    reasoning: {
      score: parsed.reasoning?.score != null ? Number(parsed.reasoning.score) : null,
      percentile: parsed.reasoning?.percentile != null ? Number(parsed.reasoning.percentile) : null,
      accuracy: parsed.reasoning?.accuracy != null ? Number(parsed.reasoning.accuracy) : null,
    },
    english: {
      score: parsed.english?.score != null ? Number(parsed.english.score) : null,
      percentile: parsed.english?.percentile != null ? Number(parsed.english.percentile) : null,
      accuracy: parsed.english?.accuracy != null ? Number(parsed.english.accuracy) : null,
    },
    ga: {
      score: parsed.ga?.score != null ? Number(parsed.ga.score) : null,
      percentile: parsed.ga?.percentile != null ? Number(parsed.ga.percentile) : null,
      accuracy: parsed.ga?.accuracy != null ? Number(parsed.ga.accuracy) : null,
    }
  } as any;`;

const retReplacement = `  } as any;

  if (subjects) {
    subjects.forEach(s => {
      if (parsed[s.id]) {
        (returnObj as any)[s.id] = {
          score: parsed[s.id]?.score != null ? Number(parsed[s.id].score) : null,
          percentile: parsed[s.id]?.percentile != null ? Number(parsed[s.id].percentile) : null,
          accuracy: parsed[s.id]?.accuracy != null ? Number(parsed[s.id].accuracy) : null,
        }
      }
    });
  } else {
    ['quant', 'reasoning', 'english', 'ga'].forEach(s => {
      if (parsed[s]) {
        (returnObj as any)[s] = {
          score: parsed[s]?.score != null ? Number(parsed[s].score) : null,
          percentile: parsed[s]?.percentile != null ? Number(parsed[s].percentile) : null,
          accuracy: parsed[s]?.accuracy != null ? Number(parsed[s].accuracy) : null,
        }
      }
    });
  }
  return returnObj;`;

gCode = gCode.replace(/    quant: \{[\s\S]*\} as any;/m, retReplacement);

// Fix the returnObj assignment
gCode = gCode.replace(`  return {\n    examType:`, `  const returnObj = {\n    examType:`);

fs.writeFileSync('src/services/geminiService.ts', gCode);

// -- 2. Patch api-router.ts --
let aCode = fs.readFileSync('api-router.ts', 'utf8');
const backendTarget = `app.post("/api/extract-scorecard", async (req, res) => {
  try {
    const { images, customApiKey } = req.body;
    const aiClient = getAiClient(customApiKey);
    
    const prompt = \`
      Extract the following details from the uploaded banking exam mock test scorecard image(s). 
      There might be multiple images (e.g. one for scores, one for percentiles). Combine the information.
      
      - Exam Type (e.g., 'SBI', 'IBPS', 'RRB', etc.)
      - Exam Role (e.g., 'PO', 'Clerk', 'AO', etc.)
      - Exam Phase (e.g., 'Prelims', 'Mains')
      - Exam Scope (e.g., 'Full', 'Sectional')
      - Mock Name (e.g., 'Mock Test 1', 'Mains Full Test 3', 'Test 1', etc.). IMPORTANT: If it's a Sectional test, DO NOT include the subject name in the mock name. For example, if it says "Numerical Ability Sectional Test 1", return just "Test 1" or "Sectional Test 1" as the mockName.
      - Platform (e.g., 'Testbook', 'PracticeMock', 'Guidely', 'Smartkeeda', 'Oliveboard', 'Adda247'). Look at logos, URLs, or UI style.
      - Date of test (YYYY-MM-DDTHH:mm format if possible)
      - Overall Score (number)
      - Overall Percentile (number, 0-100)
      - Overall Percentage (number, 0-100)
      - Overall Accuracy (number, 0-100)
      - detectedSubject (If it is a sectional test, identify the subject: "quant", "reasoning", "english", or "ga")
      
      Sectional details containing Score, Percentile, and Accuracy for:
      - Quant (Quantitative Aptitude / Numerical Ability)
      - Reasoning (Reasoning Ability)
      - English (English Language)
      - GA (General Awareness / Financial Awareness / Computer)
      
      Return as structured JSON. If any field is not visible, infer a reasonable default like null or an empty string, or do your best to detect it.
    \`;`;

const backendReplacement = `app.post("/api/extract-scorecard", async (req, res) => {
  try {
    const { images, customApiKey, subjects } = req.body;
    const aiClient = getAiClient(customApiKey);
    
    const isDynamic = subjects && Array.isArray(subjects) && subjects.length > 0;
    const subjectListStr = isDynamic 
      ? subjects.map((s: any) => \`- \${s.name} (Key: \${s.id})\`).join('\\n      ')
      : \`
      - Quant (Key: quant)
      - Reasoning (Key: reasoning)
      - English (Key: english)
      - GA (Key: ga)\`;

    const prompt = \`
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
      - Overall Accuracy (number, 0-100)
      - detectedSubject (If it is a sectional test, identify the subject key from the list below. Else null)
      
      Sectional details containing Score (number, extract only the numerator or decimal number! e.g. "16/30" -> 16, "24.75" -> 24.75), Percentile, and Accuracy for:
      \${subjectListStr}
      
      Return as structured JSON. If any field is not visible, infer a reasonable default like null or an empty string, or do your best to detect it.
    \`;`;

aCode = aCode.replace(backendTarget, backendReplacement);

const fullSchemaTarget = `      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            examType: { type: Type.STRING, description: "Type of banking exam (e.g. SBI, IBPS, RRB, LIC)" },
            examRole: { type: Type.STRING, description: "Role of the exam (e.g. PO, Clerk, AO, Assistant)" },
            examPhase: { type: Type.STRING, description: "Phase of the exam (e.g. Prelims, Mains)" },
            examScope: { type: Type.STRING, description: "Scope of the exam (e.g. Full, Sectional)" },
            mockName: { type: Type.STRING, description: "Name of the mock, without subject prefixes" },
            platform: { type: Type.STRING, description: "Platform name like Testbook, PracticeMock, etc." },
            detectedSubject: { type: Type.STRING, description: "If sectional, one of: quant, reasoning, english, ga. Else null" },
            date: { type: Type.STRING, description: "Date of the mock in YYYY-MM-DD" },
            score: { type: Type.NUMBER },
            percentile: { type: Type.NUMBER },
            percentage: { type: Type.NUMBER },
            accuracy: { type: Type.NUMBER },
            quant: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER },
                accuracy: { type: Type.NUMBER }
              }
            },
            reasoning: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER },
                accuracy: { type: Type.NUMBER }
              }
            },
            english: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER },
                accuracy: { type: Type.NUMBER }
              }
            },
            ga: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER },
                accuracy: { type: Type.NUMBER }
              }
            }
          },
          required: ["examType", "mockName"]
        }
      }
    }));`


const schemaReplacement = `            date: { type: Type.STRING, description: "Date of the mock in YYYY-MM-DD" },
            score: { type: Type.NUMBER },
            percentile: { type: Type.NUMBER },
            percentage: { type: Type.NUMBER },
            accuracy: { type: Type.NUMBER }
          }
        } as any;
        
    if (isDynamic) {
        subjects.forEach((s: any) => {
            (schemaObj.properties as any)[s.id] = {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER },
                accuracy: { type: Type.NUMBER }
              }
            };
        });
    } else {
        ['quant', 'reasoning', 'english', 'ga'].forEach(key => {
            (schemaObj.properties as any)[key] = {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                percentile: { type: Type.NUMBER },
                accuracy: { type: Type.NUMBER }
              }
            };
        });
    }
    
    schemaObj.required = ["examType", "mockName"];`;

  const finalSchemaCode = `      config: {
        responseMimeType: "application/json",
        responseSchema: (() => {
          const schemaObj = {
            type: Type.OBJECT,
            properties: {
              examType: { type: Type.STRING, description: "Type of banking exam (e.g. SBI, IBPS, RRB, LIC)" },
              examRole: { type: Type.STRING, description: "Role of the exam (e.g. PO, Clerk, AO, Assistant)" },
              examPhase: { type: Type.STRING, description: "Phase of the exam (e.g. Prelims, Mains)" },
              examScope: { type: Type.STRING, description: "Scope of the exam (e.g. Full, Sectional)" },
              mockName: { type: Type.STRING, description: "Name of the mock, without subject prefixes" },
              platform: { type: Type.STRING, description: "Platform name like Testbook, PracticeMock, etc." },
              detectedSubject: { type: Type.STRING, description: "If sectional, one of the subject keys. Else null" },
${schemaReplacement}
          return schemaObj;
        })()
      }
    }));`;

aCode = aCode.replace(fullSchemaTarget, finalSchemaCode);
fs.writeFileSync('api-router.ts', aCode);
