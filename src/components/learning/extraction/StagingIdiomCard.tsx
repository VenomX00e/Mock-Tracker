import React, { useState, useEffect } from 'react';
import { Check, Trash2, Edit2 } from 'lucide-react';

export interface StagingIdiom {
  id: string;
  phrase: string;
  meaning: string;
  example?: string;
}

export function StagingIdiomCard({
  idiom,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  idiom: StagingIdiom;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (updates: Partial<StagingIdiom>) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draftPhrase, setDraftPhrase] = useState(idiom.phrase);
  const [draftMeaning, setDraftMeaning] = useState(idiom.meaning);
  const [draftExample, setDraftExample] = useState(idiom.example || '');

  useEffect(() => {
    setDraftPhrase(idiom.phrase);
    setDraftMeaning(idiom.meaning);
    setDraftExample(idiom.example || '');
  }, [idiom, isEditing]);

  const handleSave = () => {
    onSave({
      phrase: draftPhrase.trim() || 'Untitled Idiom',
      meaning: draftMeaning.trim(),
      example: draftExample.trim(),
    });
  };

  if (isEditing) {
    return (
      <div className="p-3.5 bg-indigo-50/50 dark:bg-slate-900/90 border-2 border-indigo-500/80 rounded-xl space-y-2.5 animate-in fade-in duration-150">
        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            value={draftPhrase}
            onChange={(e) => setDraftPhrase(e.target.value)}
            placeholder="Idiom / Phrase..."
            className="px-2.5 py-1 font-bold text-xs sm:text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 flex-1"
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSave}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Check className="w-3 h-3" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
              title="Delete Idiom"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        <input
          type="text"
          value={draftMeaning}
          onChange={(e) => setDraftMeaning(e.target.value)}
          placeholder="Meaning..."
          className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <input
          type="text"
          value={draftExample}
          onChange={(e) => setDraftExample(e.target.value)}
          placeholder="Example sentence..."
          className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    );
  }

  return (
    <div
      onDoubleClick={onStartEdit}
      className="group p-3 bg-slate-50/70 hover:bg-slate-100/90 dark:bg-slate-900/40 dark:hover:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
          {idiom.phrase}
        </div>
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onStartEdit}
            className="px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-indigo-50 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
          >
            <Edit2 className="w-2.5 h-2.5" /> Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 bg-white dark:bg-slate-800 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded text-[11px] cursor-pointer"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
      {idiom.meaning && (
        <div className="text-xs text-slate-700 dark:text-slate-300">
          <span className="font-medium">Meaning: </span>
          {idiom.meaning}
        </div>
      )}
      {idiom.example && (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium">Example: </span>
          {idiom.example}
        </div>
      )}
    </div>
  );
}
