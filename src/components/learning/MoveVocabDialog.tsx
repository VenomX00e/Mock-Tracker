import React, { useState } from 'react';
import {
  Folder,
  FolderPlus,
  Plus,
  Check,
  X,
  Loader2,
  FolderCheck,
} from 'lucide-react';
import { useVocabularyStore } from '../../store/vocabularyStore';

interface MoveVocabDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vocabId: string;
  vocabWord: string;
}

export function MoveVocabDialog({
  isOpen,
  onClose,
  vocabId,
  vocabWord,
}: MoveVocabDialogProps) {
  const {
    customFolders,
    addVocabToFolder,
    removeVocabFromFolder,
    createCustomFolder,
  } = useVocabularyStore();

  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmittingNewFolder, setIsSubmittingNewFolder] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleFolder = async (folderId: string, isCurrentlyInFolder: boolean) => {
    try {
      if (isCurrentlyInFolder) {
        await removeVocabFromFolder(folderId, vocabId);
      } else {
        await addVocabToFolder(folderId, vocabId);
      }
    } catch (err) {
      console.error('Failed to update folder membership:', err);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    // Check if folder name already exists (case-insensitive)
    const exists = customFolders.some(
      (f) => f.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setErrorMsg(`Folder "${trimmed}" already exists.`);
      return;
    }

    setErrorMsg(null);
    setIsSubmittingNewFolder(true);
    try {
      // Create folder and immediately include this vocab item
      await createCustomFolder(trimmed, [vocabId]);
      setNewFolderName('');
    } catch (err) {
      console.error('Error creating folder:', err);
      setErrorMsg('Failed to create folder. Please try again.');
    } finally {
      setIsSubmittingNewFolder(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-[#151b28] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FolderCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                Save to personal section...
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Organizing: <span className="font-semibold text-slate-700 dark:text-slate-200">"{vocabWord}"</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Checklist of custom folders */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[260px]">
          {customFolders.length === 0 ? (
            <div className="py-6 text-center px-4">
              <FolderPlus className="w-8 h-8 mx-auto mb-2 text-slate-400 dark:text-slate-500" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                No custom folders yet
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Type a name below to create your first personal collection.
              </p>
            </div>
          ) : (
            customFolders.map((folder) => {
              const isSelected = (folder.vocabIds || []).includes(vocabId);
              const count = folder.vocabIds?.length || 0;

              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => handleToggleFolder(folder.id, isSelected)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60 shadow-2xs'
                      : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <Folder
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-500'
                      }`}
                    />
                    <span
                      className={`text-xs font-medium truncate ${
                        isSelected
                          ? 'text-indigo-900 dark:text-indigo-200 font-semibold'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {folder.name}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      isSelected
                        ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {count} {count === 1 ? 'word' : 'words'}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Bottom Action: Create new folder on the fly */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
          <form onSubmit={handleCreateAndAdd} className="space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => {
                  setNewFolderName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="New folder (e.g. Exam Prep)..."
                disabled={isSubmittingNewFolder}
                className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!newFolderName.trim() || isSubmittingNewFolder}
                className="flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
                title="Create folder and add word"
              >
                {isSubmittingNewFolder ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Add</span>
              </button>
            </div>
            {errorMsg && (
              <p className="text-[11px] text-red-500 dark:text-red-400 pl-1">{errorMsg}</p>
            )}
          </form>

          {/* Close / Done Action */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
