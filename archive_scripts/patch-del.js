import fs from 'fs';
let code = fs.readFileSync('src/components/AdminCategoriesTab.tsx', 'utf8');

const importTarget = `import { Plus, Trash2, Save, X, Edit2, ChevronRight, ChevronDown, Check } from 'lucide-react';`;
const importReplacement = `import { Plus, Trash2, Save, X, Edit2, ChevronRight, ChevronDown, Check, AlertTriangle } from 'lucide-react';`;
code = code.replace(importTarget, importReplacement);

const stateTarget = `  const [workingCat, setWorkingCat] = useState<Partial<ExamCategory>>({});`;
const stateReplacement = `  const [workingCat, setWorkingCat] = useState<Partial<ExamCategory>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');`;
code = code.replace(stateTarget, stateReplacement);

const deleteLogicTarget = `  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (id === 'banking') {
      alert('Cannot delete default banking category');
      return;
    }
    
    const catToDelete = categories.find(c => c.id === id);
    if (!catToDelete) return;

    if (!window.confirm('Do you want to delete this category?')) return;
    
    const confirmText = \`delete \${catToDelete.name.toLowerCase()}\`;
    const userInput = window.prompt(\`To confirm, please type "\${confirmText}"\`);
    if (userInput?.toLowerCase() !== confirmText) {
      alert('Confirmation failed. Category was not deleted.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'categories', id));
      if (selectedId === id) {
        setSelectedId(null);
        setIsEditing(false);
      }
      fetchCategories();
    } catch (e) {
      console.error(e);
    }
  };`;

const deleteLogicReplacement = `  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (id === 'banking') {
      alert('Cannot delete default banking category');
      return;
    }
    
    if (!window.confirm('Do you want to delete this category?')) return;
    
    setDeleteConfirmId(id);
    setDeleteConfirmInput('');
  };
  
  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const catToDelete = categories.find(c => c.id === deleteConfirmId);
    if (!catToDelete) {
      setDeleteConfirmId(null);
      return;
    }
    const confirmText = \`delete \${catToDelete.name.toLowerCase()}\`;
    if (deleteConfirmInput.toLowerCase() !== confirmText) {
      alert('Confirmation text does not match.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'categories', deleteConfirmId));
      if (selectedId === deleteConfirmId) {
        setSelectedId(null);
        setIsEditing(false);
      }
      setDeleteConfirmId(null);
      fetchCategories();
    } catch (e) {
      console.error(e);
    }
  };`;
code = code.replace(deleteLogicTarget, deleteLogicReplacement);

// Replace the button
const buttonTarget = `<button onClick={(e) => handleDelete(selectedId, e)} className="px-5 py-2.5 text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:border-red-800 rounded-xl transition-colors shrink-0">Delete Category</button>`;
const buttonReplacement = `<button onClick={(e) => handleDelete(selectedId, e)} title="Delete Category" className="p-2.5 text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:border-red-800 rounded-xl transition-colors shrink-0"><Trash2 className="w-5 h-5"/></button>`;
code = code.replace(buttonTarget, buttonReplacement);


// Add modal at the end before returning
const modalTarget = `    </div>
  );
}`;
const modalReplacement = `
      {deleteConfirmId && (() => {
        const catToDelete = categories.find(c => c.id === deleteConfirmId);
        if (!catToDelete) return null;
        const confirmText = \`delete \${catToDelete.name.toLowerCase()}\`;
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-sm shadow-xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Final Confirmation</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                This action is irreversible. To confirm deletion, please type:
                <br /><strong className="text-slate-900 dark:text-slate-200 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded inline-block mt-2">\${confirmText}</strong>
              </p>
              <input
                type="text"
                autoFocus
                value={deleteConfirmInput}
                onChange={e => setDeleteConfirmInput(e.target.value)}
                placeholder={confirmText}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 mb-4 text-center"
              />
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteConfirmInput.toLowerCase() !== confirmText.toLowerCase()}
                  className="flex-1 px-4 py-2 font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
`;
code = code.replace(modalTarget, modalReplacement);

fs.writeFileSync('src/components/AdminCategoriesTab.tsx', code);
console.log('patched');
