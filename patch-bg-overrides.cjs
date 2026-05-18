const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf-8');

const additions = `
:is(
    html.cyber,
    html.cyber-green,
    html.cyber-lavender,
    html.cyber-pink,
    html.cyber-orange
  )
  .bg-blue-50,
:is(
    html.cyber,
    html.cyber-green,
    html.cyber-lavender,
    html.cyber-pink,
    html.cyber-orange
  )
  [class*="dark:bg-blue-900/"] {
  background-color: rgba(59, 130, 246, 0.15) !important;
  border-color: rgba(59, 130, 246, 0.3) !important;
  color: #60a5fa !important;
}

:is(
    html.cyber,
    html.cyber-green,
    html.cyber-lavender,
    html.cyber-pink,
    html.cyber-orange
  )
  .bg-amber-50,
:is(
    html.cyber,
    html.cyber-green,
    html.cyber-lavender,
    html.cyber-pink,
    html.cyber-orange
  )
  [class*="dark:bg-amber-900/"] {
  background-color: rgba(245, 158, 11, 0.15) !important;
  border-color: rgba(245, 158, 11, 0.3) !important;
  color: #fbbf24 !important;
}
`;

css += additions;
fs.writeFileSync('src/index.css', css);
console.log('patched');
