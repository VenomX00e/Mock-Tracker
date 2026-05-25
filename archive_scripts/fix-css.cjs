const fs = require('fs');

let css = fs.readFileSync('src/index.css', 'utf-8');

const regex = /\/\* Ensure all primary \(indigo\) UI elements map to the neon accent \*\/[\s\S]*?\/\* Fix active and hover rows in tables \*\//;

const replacement = `/* Ensure all primary (indigo) UI elements map to the neon accent */
:is(html.cyber, html.cyber-green, html.cyber-lavender, html.cyber-pink, html.cyber-orange, html.hero-miles) :is(
  .text-indigo-50, .text-indigo-100, .text-indigo-200, .text-indigo-300, .text-indigo-400, .text-indigo-500, .text-indigo-600, .text-indigo-700, .text-indigo-800, .text-indigo-900,
  .dark\\:text-indigo-50, .dark\\:text-indigo-100, .dark\\:text-indigo-200, .dark\\:text-indigo-300, .dark\\:text-indigo-400, .dark\\:text-indigo-500, .dark\\:text-indigo-600, .dark\\:text-indigo-700, .dark\\:text-indigo-800, .dark\\:text-indigo-900
) {
  color: var(--neon-hex) !important;
}

:is(html.cyber, html.cyber-green, html.cyber-lavender, html.cyber-pink, html.cyber-orange, html.hero-miles) :is(
  .hover\\:text-indigo-50:hover, .hover\\:text-indigo-100:hover, .hover\\:text-indigo-200:hover, .hover\\:text-indigo-300:hover, .hover\\:text-indigo-400:hover, .hover\\:text-indigo-500:hover, .hover\\:text-indigo-600:hover, .hover\\:text-indigo-700:hover, .hover\\:text-indigo-800:hover, .hover\\:text-indigo-900:hover,
  .dark\\:hover\\:text-indigo-50:hover, .dark\\:hover\\:text-indigo-100:hover, .dark\\:hover\\:text-indigo-200:hover, .dark\\:hover\\:text-indigo-300:hover, .dark\\:hover\\:text-indigo-400:hover, .dark\\:hover\\:text-indigo-500:hover, .dark\\:hover\\:text-indigo-600:hover, .dark\\:hover\\:text-indigo-700:hover, .dark\\:hover\\:text-indigo-800:hover, .dark\\:hover\\:text-indigo-900:hover,
  .group-hover\\:text-indigo-50:hover, .group-hover\\:text-indigo-100:hover, .group-hover\\:text-indigo-200:hover, .group-hover\\:text-indigo-300:hover, .group-hover\\:text-indigo-400:hover, .group-hover\\:text-indigo-500:hover, .group-hover\\:text-indigo-600:hover, .group-hover\\:text-indigo-700:hover, .group-hover\\:text-indigo-800:hover, .group-hover\\:text-indigo-900:hover,
  .dark\\:group-hover\\:text-indigo-50:hover, .dark\\:group-hover\\:text-indigo-100:hover, .dark\\:group-hover\\:text-indigo-200:hover, .dark\\:group-hover\\:text-indigo-300:hover, .dark\\:group-hover\\:text-indigo-400:hover, .dark\\:group-hover\\:text-indigo-500:hover, .dark\\:group-hover\\:text-indigo-600:hover, .dark\\:group-hover\\:text-indigo-700:hover, .dark\\:group-hover\\:text-indigo-800:hover, .dark\\:group-hover\\:text-indigo-900:hover
) {
  color: var(--neon-hex) !important;
}

:is(html.cyber, html.cyber-green, html.cyber-lavender, html.cyber-pink, html.cyber-orange, html.hero-miles) :is(
  .bg-indigo-50, .bg-indigo-100, .bg-indigo-200, .bg-indigo-300, .bg-indigo-400, .bg-indigo-500, .bg-indigo-600, .bg-indigo-700, .bg-indigo-800, .bg-indigo-900,
  .dark\\:bg-indigo-50, .dark\\:bg-indigo-100, .dark\\:bg-indigo-200, .dark\\:bg-indigo-300, .dark\\:bg-indigo-400, .dark\\:bg-indigo-500, .dark\\:bg-indigo-600, .dark\\:bg-indigo-700, .dark\\:bg-indigo-800, .dark\\:bg-indigo-900
) {
  background-color: rgba(var(--neon-rgb), 0.15) !important;
  color: var(--neon-text) !important;
  border-color: rgba(var(--neon-rgb), 0.3) !important;
}

:is(html.cyber, html.cyber-green, html.cyber-lavender, html.cyber-pink, html.cyber-orange, html.hero-miles) :is(
  .hover\\:bg-indigo-50:hover, .hover\\:bg-indigo-100:hover, .hover\\:bg-indigo-200:hover, .hover\\:bg-indigo-300:hover, .hover\\:bg-indigo-400:hover, .hover\\:bg-indigo-500:hover, .hover\\:bg-indigo-600:hover, .hover\\:bg-indigo-700:hover, .hover\\:bg-indigo-800:hover, .hover\\:bg-indigo-900:hover,
  .dark\\:hover\\:bg-indigo-50:hover, .dark\\:hover\\:bg-indigo-100:hover, .dark\\:hover\\:bg-indigo-200:hover, .dark\\:hover\\:bg-indigo-300:hover, .dark\\:hover\\:bg-indigo-400:hover, .dark\\:hover\\:bg-indigo-500:hover, .dark\\:hover\\:bg-indigo-600:hover, .dark\\:hover\\:bg-indigo-700:hover, .dark\\:hover\\:bg-indigo-800:hover, .dark\\:hover\\:bg-indigo-900:hover,
  .group-hover\\:bg-indigo-50:hover, .group-hover\\:bg-indigo-100:hover, .group-hover\\:bg-indigo-200:hover, .group-hover\\:bg-indigo-300:hover, .group-hover\\:bg-indigo-400:hover, .group-hover\\:bg-indigo-500:hover, .group-hover\\:bg-indigo-600:hover, .group-hover\\:bg-indigo-700:hover, .group-hover\\:bg-indigo-800:hover, .group-hover\\:bg-indigo-900:hover,
  .dark\\:group-hover\\:bg-indigo-50:hover, .dark\\:group-hover\\:bg-indigo-100:hover, .dark\\:group-hover\\:bg-indigo-200:hover, .dark\\:group-hover\\:bg-indigo-300:hover, .dark\\:group-hover\\:bg-indigo-400:hover, .dark\\:group-hover\\:bg-indigo-500:hover, .dark\\:group-hover\\:bg-indigo-600:hover, .dark\\:group-hover\\:bg-indigo-700:hover, .dark\\:group-hover\\:bg-indigo-800:hover, .dark\\:group-hover\\:bg-indigo-900:hover
) {
  background-color: rgba(var(--neon-rgb), 0.25) !important;
  color: var(--neon-text) !important;
}

:is(html.cyber, html.cyber-green, html.cyber-lavender, html.cyber-pink, html.cyber-orange, html.hero-miles) :is(
  .border-indigo-50, .border-indigo-100, .border-indigo-200, .border-indigo-300, .border-indigo-400, .border-indigo-500, .border-indigo-600, .border-indigo-700, .border-indigo-800, .border-indigo-900,
  .dark\\:border-indigo-50, .dark\\:border-indigo-100, .dark\\:border-indigo-200, .dark\\:border-indigo-300, .dark\\:border-indigo-400, .dark\\:border-indigo-500, .dark\\:border-indigo-600, .dark\\:border-indigo-700, .dark\\:border-indigo-800, .dark\\:border-indigo-900
) {
  border-color: rgba(var(--neon-rgb), 0.5) !important;
}

:is(html.cyber, html.cyber-green, html.cyber-lavender, html.cyber-pink, html.cyber-orange, html.hero-miles) :is(
  .hover\\:border-indigo-50:hover, .hover\\:border-indigo-100:hover, .hover\\:border-indigo-200:hover, .hover\\:border-indigo-300:hover, .hover\\:border-indigo-400:hover, .hover\\:border-indigo-500:hover, .hover\\:border-indigo-600:hover, .hover\\:border-indigo-700:hover, .hover\\:border-indigo-800:hover, .hover\\:border-indigo-900:hover,
  .dark\\:hover\\:border-indigo-50:hover, .dark\\:hover\\:border-indigo-100:hover, .dark\\:hover\\:border-indigo-200:hover, .dark\\:hover\\:border-indigo-300:hover, .dark\\:hover\\:border-indigo-400:hover, .dark\\:hover\\:border-indigo-500:hover, .dark\\:hover\\:border-indigo-600:hover, .dark\\:hover\\:border-indigo-700:hover, .dark\\:hover\\:border-indigo-800:hover, .dark\\:hover\\:border-indigo-900:hover,
  .group-hover\\:border-indigo-50:hover, .group-hover\\:border-indigo-100:hover, .group-hover\\:border-indigo-200:hover, .group-hover\\:border-indigo-300:hover, .group-hover\\:border-indigo-400:hover, .group-hover\\:border-indigo-500:hover, .group-hover\\:border-indigo-600:hover, .group-hover\\:border-indigo-700:hover, .group-hover\\:border-indigo-800:hover, .group-hover\\:border-indigo-900:hover,
  .dark\\:group-hover\\:border-indigo-50:hover, .dark\\:group-hover\\:border-indigo-100:hover, .dark\\:group-hover\\:border-indigo-200:hover, .dark\\:group-hover\\:border-indigo-300:hover, .dark\\:group-hover\\:border-indigo-400:hover, .dark\\:group-hover\\:border-indigo-500:hover, .dark\\:group-hover\\:border-indigo-600:hover, .dark\\:group-hover\\:border-indigo-700:hover, .dark\\:group-hover\\:border-indigo-800:hover, .dark\\:group-hover\\:border-indigo-900:hover
) {
  border-color: rgba(var(--neon-rgb), 0.5) !important;
}

/* Fix active and hover rows in tables */`;

css = css.replace(regex, replacement);
fs.writeFileSync('src/index.css', css);
console.log('Fixed CSS class matching for indigo');
