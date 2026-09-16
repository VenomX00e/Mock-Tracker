const fs = require('fs');
let code = fs.readFileSync('api-router.ts', 'utf8');

code = code.replace(
  /"spottingStrategy": "string \\(Give the student a mental shortcut \/ exam strategy. Explicitly call out Trigger Words to look out for. Do NOT list extra vocabulary words from the same broad category.\\)",/,
  '"spottingStrategy": "string (Give the student a mental shortcut / exam strategy. Explicitly call out Trigger Words. MUST USE Markdown formatting: wrap trigger words in `inline code` and use **bolding** for emphasis. Do NOT list extra vocabulary words.)",'
);

code = code.replace(
  /"spottingStrategy": "Trigger: Whenever you see the quantifier 'most', immediately check if the countable noun following it is plural.",/,
  '"spottingStrategy": "**Trigger:** Whenever you see the quantifier `most`, immediately check if the countable noun following it is plural.",'
);

code = code.replace(
  /"spottingStrategy": "Trigger: When a sentence begins with 'Had' \+ Subject \+ V3 \\(inverted conditional\\), check the main clause for 'would\/could\/might have \+ V3'. Examiners often trap you with 'will have'.",/,
  '"spottingStrategy": "**Trigger:** When a sentence begins with `Had` + Subject + V3 (inverted conditional), check the main clause for `would/could/might have + V3`. Examiners often trap you with `will have`.",'
);

fs.writeFileSync('api-router.ts', code);
