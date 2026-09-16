const fs = require('fs');
let code = fs.readFileSync('api-router.ts', 'utf8');

const oldMandates = `CRITICAL MANDATES FOR STEP 1:
- You MUST map the user's input (e.g., A/ B/ C/) strictly into the \\\`segments\\\` array.
- You MUST explicitly isolate the exact word/phrase in \\\`incorrectText\\\` and its replacement in \\\`correctText\\\`.
- NEVER write markdown text, paragraphs, or ASCII flow arrows instead of JSON.
- The JSON block MUST be strictly valid and parseable by standard JSON.parse().
- Always include at least 1 valid formula ("isValid": true) and 1 invalid trap ("isValid": false).
- Under "example", ALWAYS write a FRESH, NEW, DIFFERENT illustrative sentence (DO NOT repeat or copy the user's input sentence). Use [brackets] enclosing the target words.

<examples>
FEW-SHOT DEMONSTRATION 1 (Quantifier / Determiner Agreement):
User Input: "...yet regulatory oversight remains shockingly lax (C)/ across most semi-urban and rural region. (D)/ No error (E)"

1. **Grammar Blueprint (JSON Block):**
\\\`\\\`\\\`json
{
  "grammarBlueprint": {
    "ruleName": "Quantifier-Noun Agreement (\\"Most + Plural Countable Noun\\")",
    "originalSentenceBreakdown": {
      "segments": [
        { "part": "(C)", "text": "...yet regulatory oversight remains shockingly lax", "isError": false },
        { "part": "(D)", "text": "across most semi-urban and rural region.", "isError": true },
        { "part": "(E)", "text": "No error", "isError": false }
      ],
      "incorrectText": "region",
      "correctText": "regions",
      "fixReason": "The word 'most' is a plural quantifier and must be followed by a plural countable noun."
    },
    "spottingStrategy": "Trigger: Whenever you see the quantifier 'most', immediately check if the countable noun following it is plural.",
    "formulas": [
      { "text": "most + Plural Countable Noun (e.g., most regions)", "isValid": true },
      { "text": "most + Singular Countable Noun (e.g., most region)", "isValid": false }
    ],
    "example": {
      "incorrect": "Most modern [institution] require strict compliance with regulatory standards.",
      "correct": "Most modern [institutions] require strict compliance with regulatory standards."
    }
  }
}
\\\`\\\`\\\`

2. **⚡ Quick Test (Active Recall):**
   Test your understanding of this rule:
   *(A) Despite the recent / (B) economic downturn, / (C) most local business / (D) have managed to survive. / (E) No error*
   [TEST_KEY: {"correct": "C", "explanation": "Replace 'business' with 'businesses' because the quantifier 'most' requires a plural countable noun.", "correctSentence": "Despite the recent economic downturn, most local businesses have managed to survive."}]

FEW-SHOT DEMONSTRATION 2 (Inverted Conditional):
User Input: "Had the authorities acted promptly, (A)/ the crisis will not have caused (B)/ such severe damage. (C)/ No error (D)"

1. **Grammar Blueprint (JSON Block):**
\\\`\\\`\\\`json
{
  "grammarBlueprint": {
    "ruleName": "Third Conditional (Past Unreal Inversion with \\"Had\\")",
    "originalSentenceBreakdown": {
      "segments": [
        { "part": "(A)", "text": "Had the authorities acted promptly,", "isError": false },
        { "part": "(B)", "text": "the crisis will not have caused", "isError": true },
        { "part": "(C)", "text": "such severe damage.", "isError": false },
        { "part": "(D)", "text": "No error", "isError": false }
      ],
      "incorrectText": "will not have caused",
      "correctText": "would not have caused",
      "fixReason": "The past unreal inversion ('Had acted') requires the past modal 'would have' instead of the future modal 'will have'."
    },
    "spottingStrategy": "Trigger: When a sentence begins with 'Had' + Subject + V3 (inverted conditional), check the main clause for 'would/could/might have + V3'. Examiners often trap you with 'will have'.",`;

const newMandates = `CRITICAL MANDATES FOR STEP 1:
- You MUST explicitly isolate the exact word/phrase in \\\`errorText\\\` and its replacement in \\\`correctText\\\`.
- You MUST strip out all exam dividers like (A), (B), (C), (D) from the prefix and suffix.
- NEVER write markdown text, paragraphs, or ASCII flow arrows instead of JSON.
- The JSON block MUST be strictly valid and parseable by standard JSON.parse().
- Always include at least 1 valid formula ("isValid": true) and 1 invalid trap ("isValid": false).
- Under "example", ALWAYS write a FRESH, NEW, DIFFERENT illustrative sentence (DO NOT repeat or copy the user's input sentence). Use [brackets] enclosing the target words.

<examples>
FEW-SHOT DEMONSTRATION 1 (Quantifier / Determiner Agreement):
User Input: "...yet regulatory oversight remains shockingly lax (C)/ across most semi-urban and rural region. (D)/ No error (E)"

1. **Grammar Blueprint (JSON Block):**
\\\`\\\`\\\`json
{
  "grammarBlueprint": {
    "ruleName": "Quantifier-Noun Agreement (\\"Most + Plural Countable Noun\\")",
    "originalSentenceBreakdown": {
      "prefix": "...yet regulatory oversight remains shockingly lax across most semi-urban and rural ",
      "errorText": "region.",
      "correctText": "regions.",
      "suffix": ""
    },
    "spottingStrategy": "Trigger: Whenever you see the quantifier 'most', immediately check if the countable noun following it is plural.",
    "formulas": [
      { "text": "most + Plural Countable Noun (e.g., most regions)", "isValid": true },
      { "text": "most + Singular Countable Noun (e.g., most region)", "isValid": false }
    ],
    "example": {
      "incorrect": "Most modern [institution] require strict compliance with regulatory standards.",
      "correct": "Most modern [institutions] require strict compliance with regulatory standards."
    }
  }
}
\\\`\\\`\\\`

2. **⚡ Quick Test (Active Recall):**
   Test your understanding of this rule:
   *(A) Despite the recent / (B) economic downturn, / (C) most local business / (D) have managed to survive. / (E) No error*
   [TEST_KEY: {"correct": "C", "explanation": "Replace 'business' with 'businesses' because the quantifier 'most' requires a plural countable noun.", "correctSentence": "Despite the recent economic downturn, most local businesses have managed to survive."}]

FEW-SHOT DEMONSTRATION 2 (Inverted Conditional):
User Input: "Had the authorities acted promptly, (A)/ the crisis will not have caused (B)/ such severe damage. (C)/ No error (D)"

1. **Grammar Blueprint (JSON Block):**
\\\`\\\`\\\`json
{
  "grammarBlueprint": {
    "ruleName": "Third Conditional (Past Unreal Inversion with \\"Had\\")",
    "originalSentenceBreakdown": {
      "prefix": "Had the authorities acted promptly, the crisis ",
      "errorText": "will not have caused",
      "correctText": "would not have caused",
      "suffix": " such severe damage."
    },
    "spottingStrategy": "Trigger: When a sentence begins with 'Had' + Subject + V3 (inverted conditional), check the main clause for 'would/could/might have + V3'. Examiners often trap you with 'will have'.",`;

code = code.replace(oldMandates, newMandates);
fs.writeFileSync('api-router.ts', code);
