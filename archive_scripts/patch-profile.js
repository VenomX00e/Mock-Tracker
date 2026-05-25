const fs = require('fs');
let code = fs.readFileSync('src/components/ProfileDialog.tsx', 'utf8');

const t1 = `  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0, transition: { duration: 0 } }} 
            className="absolute inset-0 bg-slate-900/50 " 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.05 } }} 
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-700 relative z-10"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Edit Profile</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const newTheme = theme === 'cyber' ? 'light' : theme === 'dark' ? 'cyber' : 'dark';
                setTheme(newTheme);
              }}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
              title="Toggle theme"
            >
              {theme === 'cyber' ? <Gamepad2 className="w-5 h-5 text-sky-400" /> : theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>`;

const r1 = `  const content = (
    <div className={\`bg-white dark:bg-slate-800 \${asPage ? "w-full rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700" : "rounded-2xl shadow-xl w-full max-w-md border border-slate-100 dark:border-slate-700"} overflow-hidden relative z-10\`}>
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Edit Profile</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              const newTheme = theme === 'cyber' ? 'light' : theme === 'dark' ? 'cyber' : 'dark';
              setTheme(newTheme);
            }}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
            title="Toggle theme"
          >
            {theme === 'cyber' ? <Gamepad2 className="w-5 h-5 text-sky-400" /> : theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          {!asPage && (
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>`;

code = code.replace(t1, r1);

// We should replace the exact end of ProfileDialog
const t2 = `          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}`;

const r2 = `      {/* END REP */}
`;

const after = `
  if (asPage) return content;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0, transition: { duration: 0 } }} 
            className="absolute inset-0 bg-slate-900/50 " 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.05 } }} 
            className="w-full max-w-md relative z-10"
          >
            {content}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}`;

code = code.replace(t2, r2) + after;

fs.writeFileSync('src/components/ProfileDialog.tsx', code);
