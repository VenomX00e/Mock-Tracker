const fs = require('fs');
let code = fs.readFileSync('api-router.ts', 'utf8');

const oldLogic = `    if (useCustomWebSearch) {
      systemInstruction += "\\n\\nYou have access to a custom web search tool. Categorize your search as 'news_and_facts' for current events/data, 'semantic_concept' for abstract topics/blogs, or 'general' for basic queries.";
    }

    const config: any = {
      systemInstruction,
    };`;

const newLogic = `    if (useCustomWebSearch) {
      systemInstruction += "\\n\\nYou have access to a custom web search tool. Categorize your search as 'news_and_facts' for current events/data, 'semantic_concept' for abstract topics/blogs, or 'general' for basic queries.";
    }

    const now = new Date();
    const istDateTime = now.toLocaleString("en-IN", { 
      timeZone: "Asia/Kolkata", 
      dateStyle: "full", 
      timeStyle: "long" 
    });
    systemInstruction += \`\\n\\n[System Note: The current date and time is \${istDateTime} (IST).]\`;

    const config: any = {
      systemInstruction,
    };`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('api-router.ts', code);
console.log("Patched");
