const fs = require('fs');

let apiRouter = fs.readFileSync('api-router.ts', 'utf8');

// replace the catch blocks to send the full error
apiRouter = apiRouter.replace(/res\.status\(500\)\.json\(\{ error: formatGeminiError\(error\) \}\);/g, 
  'res.status(500).json({ error: String(error.message || error) });'
);

fs.writeFileSync('api-router.ts', apiRouter);
console.log('patched');
