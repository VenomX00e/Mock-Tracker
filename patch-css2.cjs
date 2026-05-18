const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf-8');

const varDefinitions = `
/* Neon Color Variables */
html.cyber {
  --neon-rgb: 14, 165, 233;   /* sky-500 */
  --neon-hex-rgb: 56, 189, 248;       /* sky-400 rgb */
  --neon-hex: #38bdf8;        /* sky-400 */
  --neon-text: #bae6fd;       /* sky-200 */
  --neon-muted: #7dd3fc;      /* sky-300 */
}
html.cyber-green {
  --neon-rgb: 34, 197, 94;
  --neon-hex-rgb: 74, 222, 128;
  --neon-hex: #4ade80;
  --neon-text: #bbf7d0;
  --neon-muted: #86efac;
}
html.cyber-lavender {
  --neon-rgb: 168, 85, 247;
  --neon-hex-rgb: 192, 132, 252;
  --neon-hex: #c084fc;
  --neon-text: #e9d5ff;
  --neon-muted: #d8b4fe;
}
html.cyber-pink {
  --neon-rgb: 236, 72, 153;
  --neon-hex-rgb: 244, 114, 182;
  --neon-hex: #f472b6;
  --neon-text: #fbcfe8;
  --neon-muted: #f9a8d4;
}
html.cyber-orange {
  --neon-rgb: 249, 115, 22;
  --neon-hex-rgb: 251, 146, 60;
  --neon-hex: #fb923c;
  --neon-text: #fed7aa;
  --neon-muted: #fdba74;
}
`;

css = css.replace('/* Cyberpunk / Gamer Theme Overrides */', '/* Cyberpunk / Gamer Theme Overrides */\n' + varDefinitions);

// Using regex to match html.cyber but exclude html.cyber-light
const cyberSelectorRegex = /html\.cyber(?![\w\-])/g;
css = css.replace(cyberSelectorRegex, ':is(html.cyber, html.cyber-green, html.cyber-lavender, html.cyber-pink, html.cyber-orange)');

// Replace hardcoded values inside those rules
css = css.replace(/rgba\(14,\s*165,\s*233,\s*([0-9.]+)\)/g, 'rgba(var(--neon-rgb), $1)');
css = css.replace(/rgba\(56,\s*189,\s*248,\s*([0-9.]+)\)/g, 'rgba(var(--neon-hex-rgb), $1)');
css = css.replace(/#bae6fd/g, 'var(--neon-text)');
css = css.replace(/#38bdf8/g, 'var(--neon-hex)');
css = css.replace(/#7dd3fc/g, 'var(--neon-muted)');

fs.writeFileSync('src/index.css', css);
console.log('CSS patched successfully!');
