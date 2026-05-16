import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ExamCategory } from '../../types';

export interface AdminCategoryDeleteModalProps {
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  categories: ExamCategory[];
  deleteStep: 1 | 2;
  setDeleteStep: (step: 1 | 2) => void;
  deleteConfirmInput: string;
  setDeleteConfirmInput: (val: string) => void;
  confirmDelete: () => void;
}

export const AdminCategoryDeleteModal: React.FC<AdminCategoryDeleteModalProps> = ({
  deleteConfirmId,
  setDeleteConfirmId,
  categories,
  deleteStep,
  setDeleteStep,
  deleteConfirmInput,
  setDeleteConfirmInput,
  confirmDelete,
}) => {
  if (!deleteConfirmId) return null;
  const catToDelete = categories.find((c) => c.id === deleteConfirmId);
  if (!catToDelete) return null;
  const confirmText = `delete ${catToDelete.name.toLowerCase()}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 ">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-sm shadow-xl flex flex-col items-center text-center animate-in zoom-in-95 duration-0">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>

        {deleteStep === 1 ? (
          <>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Delete Category?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Do you want to delete this category ({catToDelete.name})?
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                No
              </button>
              <button
                onClick={() => setDeleteStep(2)}
                className="flex-1 px-4 py-2 font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm shadow-red-500/20"
              >
                Yes
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Final Confirmation
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              This action is irreversible. To confirm deletion, please
              type:
              <br />
              <strong className="text-slate-900 dark:text-slate-200 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded inline-block mt-2">
                {confirmText}
              </strong>
            </p>
            <input
              type="text"
              autoFocus
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
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
                disabled={
                  deleteConfirmInput.toLowerCase() !==
                  confirmText.toLowerCase()
                }
                className="flex-1 px-4 py-2 font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm shadow-red-500/20"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
