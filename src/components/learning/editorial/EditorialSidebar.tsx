import React from "react";
import { Type, Plus } from "lucide-react";
import { VocabWordBox } from "../VocabWordBox";
import { VocabEntry } from "../../../store/vocabularyStore";

interface EditorialSidebarProps {
  canvasId: string;
  vocabularies: VocabEntry[];
  canManageLearning: boolean;
  addVocab: (canvasId: string, vocab: Omit<VocabEntry, "id" | "isMastered">) => void;
  updateVocab: (canvasId: string, vocabId: string, updates: Partial<VocabEntry>) => void;
  deleteVocab: (canvasId: string, vocabId: string) => void;
}

export function EditorialSidebar({
  canvasId,
  vocabularies,
  canManageLearning,
  addVocab,
  updateVocab,
  deleteVocab,
}: EditorialSidebarProps) {
  return (
    <div
      className="overflow-y-auto py-3 px-[10px] md:py-6 md:px-[15px] scrollbar-thin bg-white dark:bg-[#0f172a]/50 flex-none"
      style={{ flexBasis: "var(--left-width)" } as React.CSSProperties}
    >
      <div className="flex justify-between items-center mb-4 pt-2">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Type className="w-4 h-4 text-indigo-500" /> Vocabulary
        </h3>
        {canManageLearning && (
          <button
            onClick={() =>
              addVocab(canvasId, {
                word: "",
                pos: "",
                synonyms: [],
                antonyms: [],
                example: "",
                meaning: "",
                mnemonic: "",
                additional: "",
              })
            }
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            title="Add new vocabulary"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {vocabularies.map((vocab) => (
          <VocabWordBox
            key={vocab.id}
            vocab={vocab}
            onUpdate={(updates) => updateVocab(canvasId, vocab.id, updates)}
            onDelete={() => deleteVocab(canvasId, vocab.id)}
            canManageLearning={canManageLearning}
          />
        ))}

        {vocabularies.length === 0 && (
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-slate-400" />
            </div>
            <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-1">
              No vocabulary added yet
            </h4>
            {canManageLearning && (
              <p className="text-sm text-slate-500">
                Click the "Add Word" button above to insert your first
                editorial word.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
