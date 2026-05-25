const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const textInputRegex = /<input\s+([^>]*?)type=["']text["']([^>]*?)>/g;
      let changed = false;
      content = content.replace(textInputRegex, (match, prefix, suffix) => {
        if (!match.includes('autoComplete')) {
            changed = true;
            return `<input ${prefix}type="text" autoComplete="off" spellCheck="false" ${suffix}>`;
        }
        return match;
      });

      // Handle multiline `<input \n type="text"` using a simpler replace
      if (!changed) {
          if (content.includes('type="text"') && content.includes('<input')) {
              content = content.replace(/<input\s([^>]+)type="text"/g, (match, p1) => {
                if(!p1.includes('autoComplete')) {
                  changed = true;
                  return `<input ${p1}type="text" autoComplete="off" spellCheck="false"`;
                }
                return match;
              });
          }
      }

      // AddMockDialog special case
      if (fullPath.includes('AddMockDialog') && !changed) {
          content = content.replace(/type="text"/g, 'type="text"\n                        autoComplete="off" spellCheck="false"');
          changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir('./src/components');
