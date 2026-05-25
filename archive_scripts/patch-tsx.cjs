const fs = require('fs');

function patchNavigation() {
  let code = fs.readFileSync('src/components/Navigation.tsx', 'utf-8');
  
  const neonCircles = `
                {theme.startsWith('cyber') && (
                  <div className="flex items-center gap-1.5 ml-1 hidden sm:flex bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-full shadow-inner border border-slate-200 dark:border-slate-700">
                    {[
                      { id: theme.includes('-light') ? 'cyber-light' : 'cyber', bg: 'bg-[#0ea5e9]' },
                      { id: 'cyber-green', bg: 'bg-[#22c55e]' },
                      { id: 'cyber-lavender', bg: 'bg-[#a855f7]' },
                      { id: 'cyber-pink', bg: 'bg-[#ec4899]' },
                      { id: 'cyber-orange', bg: 'bg-[#f97316]' },
                    ].map(color => (
                        <button
                          key={color.id}
                          onClick={() => setTheme(color.id)}
                          className={\`w-4 h-4 rounded-full \${color.bg} \${theme === color.id ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-indigo-400 dark:ring-offset-slate-900 border-2 border-white' : 'opacity-60 hover:opacity-100 hover:scale-110 transition-all'}\`}
                          title={'Select ' + color.id + ' color'}
                        />
                    ))}
                  </div>
                )}
`;

  // Find where the Gamepad2 button ends in Navigation.tsx
  const gamepadRegex = /(<Gamepad2 className="w-5 h-5"[^>]*\/>\s*<\/button>)/;
  code = code.replace(gamepadRegex, '$1\n' + neonCircles);
  
  fs.writeFileSync('src/components/Navigation.tsx', code);
}

function patchProfileDialog() {
  let code = fs.readFileSync('src/components/ProfileDialog.tsx', 'utf-8');
  
  const neonCirclesProfile = `
                 {theme.startsWith('cyber') && (
                    <div className="flex bg-slate-900/40 backdrop-blur-md rounded-full shadow-lg items-center px-2 py-1 gap-1.5">
                      {[
                        { id: theme.includes('-light') ? 'cyber-light' : 'cyber', bg: 'bg-[#0ea5e9]' },
                        { id: 'cyber-green', bg: 'bg-[#22c55e]' },
                        { id: 'cyber-lavender', bg: 'bg-[#a855f7]' },
                        { id: 'cyber-pink', bg: 'bg-[#ec4899]' },
                        { id: 'cyber-orange', bg: 'bg-[#f97316]' },
                      ].map(color => (
                          <button
                            key={color.id}
                            onClick={() => setTheme(color.id)}
                            className={\`w-4 h-4 rounded-full \${color.bg} \${theme === color.id ? 'ring-2 ring-white scale-110 shadow-[0_0_8px_currentColor]' : 'opacity-70 hover:opacity-100 hover:scale-110 transition-all'}\`}
                            title={'Select ' + color.id}
                            style={{ color: color.bg.replace('bg-[', '').replace(']', '') }}
                          />
                      ))}
                    </div>
                 )}
`;

  const profileGamepadRegex = /(<Gamepad2 className="w-4 h-4"[^>]*\/>\s*<\/button>)/;
  code = code.replace(profileGamepadRegex, '$1\n' + neonCirclesProfile);
  
  fs.writeFileSync('src/components/ProfileDialog.tsx', code);
}

patchNavigation();
patchProfileDialog();
console.log('TSX patched successfully!');
