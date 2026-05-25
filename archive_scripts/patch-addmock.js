const fs = require('fs');
let code = fs.readFileSync('src/components/AddMockDialog.tsx', 'utf8');

const target1 = `  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0, transition: { duration: 0.05 } }} 
            className="absolute inset-0 bg-black/50 " 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.05 } }} 
            className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 relative z-10"
          >
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-6 flex items-center justify-between z-10 shrink-0">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{initialMock ? 'Edit Mock Score' : 'Add Mock Score'}</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>`;

const rep1 = `  const content = (
    <div className={\`bg-white dark:bg-slate-900 \${asPage ? "w-full rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800" : "rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl border border-slate-200 dark:border-slate-800"} overflow-hidden flex flex-col relative z-10\`}>
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-6 flex items-center justify-between z-10 shrink-0">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{initialMock ? 'Edit Mock Score' : 'Add Mock Score'}</h2>
        {!asPage && (
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-6 h-6" />
          </button>
        )}
      </div>`;

code = code.replace(target1, rep1);

const target2 = `    </AnimatePresence>
  );
}`;

const rep2 = `
  if (asPage) return content;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0, transition: { duration: 0.05 } }} 
            className="absolute inset-0 bg-black/50 " 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.05 } }} 
            className="w-full max-w-3xl flex flex-col relative z-10 max-h-[90vh]"
          >
            {content}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}`;

// need to replace the end part
// Wait, the end part in AddMockDialog is currently:
/*
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
*/

const target2b = `          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}`;

// I'll replace target2b
code = code.replace(target2b, `      {/* REPLACED_END */}
`);

// Then add the bottom part
code = code + rep2;

fs.writeFileSync('src/components/AddMockDialog.tsx', code);
