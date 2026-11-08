import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, Edit2 } from 'lucide-react';

export interface StagingWord {
  id: string;
  word: string;
  pos: string;
  meaning: string;
  mnemonic?: string;
  synonyms: string[];
  antonyms: string[];
  additional?: string;
  additionalGroups?: Array<{ theme: string; terms: string }>;
  example?: string;
  editorialContext?: string;
}

export function StagingWordCard({
  word,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  word: StagingWord;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (updates: Partial<StagingWord>) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draftWord, setDraftWord] = useState(word.word);
  const [draftPos, setDraftPos] = useState(word.pos || 'Noun');
  const [draftMeaning, setDraftMeaning] = useState(word.meaning || '');
  const [draftSynonyms, setDraftSynonyms] = useState(word.synonyms?.join(', ') || '');
  const [draftAntonyms, setDraftAntonyms] = useState(word.antonyms?.join(', ') || '');
  const [draftAdditional, setDraftAdditional] = useState(
    word.additional ||
      (word.additionalGroups
        ? word.additionalGroups.map((g) => `(${g.theme}): ${g.terms}`).join('\n')
        : '')
  );
  const [draftExample, setDraftExample] = useState(word.example || '');

  useEffect(() => {
    setDraftWord(word.word);
    setDraftPos(word.pos || 'Noun');
    setDraftMeaning(word.meaning || '');
    setDraftSynonyms(word.synonyms?.join(', ') || '');
    setDraftAntonyms(word.antonyms?.join(', ') || '');
    setDraftAdditional(
      word.additional ||
        (word.additionalGroups
          ? word.additionalGroups.map((g) => `(${g.theme}): ${g.terms}`).join('\n')
          : '')
    );
    setDraftExample(word.example || '');
  }, [word, isEditing]);

  const handleSave = () => {
    const synList = draftSynonyms
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const antList = draftAntonyms
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const additionalLines = draftAdditional.split('\n');
    const groups: Array<{ theme: string; terms: string }> = [];
    for (const line of additionalLines) {
      const match = line.match(/^\s*\(([^)]+)\)\s*:\s*(.+)$/);
      if (match) {
        groups.push({ theme: match[1].trim(), terms: match[2].trim() });
      } else if (line.trim()) {
        groups.push({ theme: 'Related', terms: line.trim() });
      }
    }

    onSave({
      word: draftWord.trim() || 'Untitled Word',
      pos: draftPos.trim() || 'Noun',
      meaning: draftMeaning.trim(),
      synonyms: synList,
      antonyms: antList,
      additional: draftAdditional.trim(),
      additionalGroups: groups,
      example: draftExample.trim(),
      editorialContext: draftAdditional.trim(),
    });
  };

  if (isEditing) {
    return (
      <div className="p-4 bg-indigo-50/50 dark:bg-slate-900/90 border-2 border-indigo-500/80 rounded-2xl space-y-3.5 shadow-sm animate-in fade-in duration-150">
        {/* Header: Word Name & POS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-indigo-100 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={draftWord}
              onChange={(e) => setDraftWord(e.target.value)}
              placeholder="Word / Term..."
              className="px-3 py-1.5 font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 flex-1 max-w-xs"
              autoFocus
            />
            <select
              value={draftPos}
              onChange={(e) => setDraftPos(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Noun">Noun</option>
              <option value="Verb">Verb</option>
              <option value="Adjective">Adjective</option>
              <option value="Adverb">Adverb</option>
              <option value="Idiom">Idiom</option>
              <option value="Phrasal Verb">Phrasal Verb</option>
              <option value="Preposition">Preposition</option>
              <option value="Conjunction">Conjunction</option>
              <option value="Interjection">Interjection</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 self-end sm:self-center">
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
              title="Delete Word"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Meaning */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Meaning:
          </label>
          <textarea
            rows={2}
            value={draftMeaning}
            onChange={(e) => setDraftMeaning(e.target.value)}
            placeholder="Definitions and contextual meaning..."
            className="w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
          />
        </div>

        {/* Synonyms & Antonyms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Synonyms (comma-separated):
            </label>
            <input
              type="text"
              value={draftSynonyms}
              onChange={(e) => setDraftSynonyms(e.target.value)}
              placeholder="e.g. Turbulent, Tumultuous, Volatile"
              className="w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Antonyms (comma-separated):
            </label>
            <input
              type="text"
              value={draftAntonyms}
              onChange={(e) => setDraftAntonyms(e.target.value)}
              placeholder="e.g. Tranquil, Calm, Placid, Serene"
              className="w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Additional Themes & Words */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Additional Themes & Related Words:
            </label>
            <span className="text-[10px] text-slate-400 font-mono">
              Format: (Theme): Word1, Word2
            </span>
          </div>
          <textarea
            rows={3}
            value={draftAdditional}
            onChange={(e) => setDraftAdditional(e.target.value)}
            placeholder={`(Extreme Turmoil/Chaos): Turmoil, Turbulence, Cataclysmic\n(Uncontrolled Emotions): Uncontrolled excitement`}
            className="w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-mono leading-relaxed"
          />
        </div>

        {/* Example Sentence */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Example Sentence:
          </label>
          <textarea
            rows={2}
            value={draftExample}
            onChange={(e) => setDraftExample(e.target.value)}
            placeholder="e.g. The country endured a very turbulent period..."
            className="w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      onDoubleClick={onStartEdit}
      className="group relative p-4 bg-slate-50/70 hover:bg-slate-100/90 dark:bg-slate-900/40 dark:hover:bg-slate-900/80 border border-slate-200/80 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-900/60 rounded-2xl space-y-1.5 transition-all duration-150"
    >
      {/* Top Bar with Word Title and Floating Edit / Delete Controls */}
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
          {word.word} ({word.pos || 'Noun'})
        </div>
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onStartEdit}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
            title="Edit this word entry"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Delete this word"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Meaning */}
      {word.meaning && (
        <div className="text-slate-800 dark:text-slate-200">
          <span className="font-medium text-slate-900 dark:text-slate-100">Meaning: </span>
          <span>{word.meaning}</span>
        </div>
      )}

      {/* Synonyms */}
      {word.synonyms && word.synonyms.length > 0 && (
        <div className="text-slate-800 dark:text-slate-200">
          <span className="font-medium text-slate-900 dark:text-slate-100">Synonyms: </span>
          <span>{word.synonyms.join(', ')}</span>
        </div>
      )}

      {/* Antonyms */}
      {word.antonyms && word.antonyms.length > 0 && (
        <div className="text-slate-800 dark:text-slate-200">
          <span className="font-medium text-slate-900 dark:text-slate-100">Antonyms: </span>
          <span>{word.antonyms.join(', ')}</span>
        </div>
      )}

      {/* Additional Themes & Words */}
      {(word.additional || (word.additionalGroups && word.additionalGroups.length > 0)) && (
        <div className="text-slate-800 dark:text-slate-200">
          <div className="font-medium text-slate-900 dark:text-slate-100">Additional:</div>
          {word.additionalGroups && word.additionalGroups.length > 0 ? (
            <div className="space-y-0.5 mt-0.5">
              {word.additionalGroups.map((g, gIdx) => (
                <div key={gIdx} className="text-slate-800 dark:text-slate-200">
                  ({g.theme}): {g.terms}
                </div>
              ))}
            </div>
          ) : (
            <div className="whitespace-pre-wrap mt-0.5">{word.additional}</div>
          )}
        </div>
      )}

      {/* Example */}
      {word.example && (
        <div className="text-slate-800 dark:text-slate-200">
          <span className="font-medium text-slate-900 dark:text-slate-100">Example: </span>
          <span>{word.example}</span>
        </div>
      )}
    </div>
  );
}
