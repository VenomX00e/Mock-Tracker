const fs = require('fs');
let code = fs.readFileSync('api-router.ts', 'utf8');

code = code.replace(
  "const systemInstruction = `You are a helpful and encouraging AI Tutor focused on helping the user learn. Provide concise, clear, and educational responses. If explaining complex topics, use analogies. ${modeInstruction}",
  "let systemInstruction = `You are a helpful and encouraging AI Tutor focused on helping the user learn. Provide concise, clear, and educational responses. If explaining complex topics, use analogies. ${modeInstruction}"
);

code = code.replace(
  "    const config: any = {\n      systemInstruction,\n    };\n\n    if (useWebSearch) {\n      config.tools = [{ googleSearch: {} }];\n    }",
  `    if (useCustomWebSearch) {
      systemInstruction += "\\n\\nYou have access to a custom web search tool. Categorize your search as 'news_and_facts' for current events/data, 'semantic_concept' for abstract topics/blogs, or 'general' for basic queries.";
    }

    const config: any = {
      systemInstruction,
    };
    
    config.tools = [];

    if (useWebSearch) {
      config.tools.push({ googleSearch: {} });
    }
    
    if (useCustomWebSearch) {
      config.tools.push({
        functionDeclarations: [
          {
            name: "custom_web_search",
            description: "Search the web for information",
            parameters: {
              type: "OBJECT",
              properties: {
                query: {
                  type: "STRING",
                  description: "The optimized search query"
                },
                search_type: {
                  type: "STRING",
                  description: "Category of search",
                  enum: ["news_and_facts", "semantic_concept", "general"]
                }
              },
              required: ["query", "search_type"]
            }
          }
        ]
      });
    }
    
    if (config.tools.length === 0) {
      delete config.tools;
    }
`
);

fs.writeFileSync('api-router.ts', code);
