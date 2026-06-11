import React from 'react';
import { BookOpen } from 'lucide-react';
import { ExamCategory } from '../../types';

export function AdminLearningTab({
  categories,
  adminCategoryScope,
  setAdminCategoryScope,
  practiceSetsTabNode,
  isForcedCategory
}: {
  categories: ExamCategory[];
  adminCategoryScope: string | null;
  setAdminCategoryScope: (id: string | null) => void;
  practiceSetsTabNode: React.ReactNode;
  isForcedCategory?: boolean;
}) {
  if (adminCategoryScope) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-none relative">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2">
            {!isForcedCategory && (
              <>
                <button onClick={() => setAdminCategoryScope(null)} className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                  &larr; Back to Categories
                </button>
                <span className="text-sm text-slate-300 dark:text-slate-700">|</span>
              </>
            )}
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {categories.find(c => c.id === adminCategoryScope)?.name || adminCategoryScope}
            </span>
          </div>
        </div>
        <div className="flex-1 relative overflow-y-auto p-6 custom-scrollbar">
          {practiceSetsTabNode}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto">
      <div className="p-6 max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-3 mb-6 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
           <BookOpen className="w-8 h-8 text-indigo-500" />
           <div>
             <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Learning Management</h3>
             <p className="text-sm text-slate-500">
               Select a category to manage Practice Sets and learning materials.
             </p>
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setAdminCategoryScope(cat.id)}
              className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors text-left shadow-sm hover:shadow"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 overflow-hidden">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{cat.name}</h4>
                <p className="text-xs text-slate-500 truncate">{cat.subjects?.length || 0} subjects</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
