import React from 'react';
import {
  Copy,
  Check,
  BookOpen,
  ArrowLeft,
  Plus,
  Search,
  Download,
  Code,
  Eye,
} from 'lucide-react';
import { formatVocabToMarkdown } from '../../../utils/vocabMarkdownParser';
import { StagingWord, StagingWordCard } from './StagingWordCard';
import { StagingIdiom, StagingIdiomCard } from './StagingIdiomCard';

interface ExtractionStep3StagingProps {
  stagingTitle: string;
  setStagingTitle: (val: string) => void;
  stagingWords: StagingWord[];
  stagingIdioms: StagingIdiom[];
  stagingMarkdown: string;
  setStagingMarkdown: (val: string) => void;
  step3ViewMode: 'rendered' | 'editor';
  setStep3ViewMode: (mode: 'rendered' | 'editor') => void;
  copiedMarkdown: boolean;
  handleCopyMarkdown: () => void;
  handleDownloadMarkdown: () => void;
  stagingSearch: string;
  setStagingSearch: (val: string) => void;
  handleAddNewWord: () => void;
  handleAddNewIdiom: () => void;
  filteredWords: StagingWord[];
  filteredIdioms: StagingIdiom[];
  editingWordId: string | null;
  setEditingWordId: (id: string | null) => void;
  handleUpdateWord: (id: string, updates: Partial<StagingWord>) => void;
  handleDeleteWord: (id: string) => void;
  editingIdiomId: string | null;
  setEditingIdiomId: (id: string | null) => void;
  handleUpdateIdiom: (id: string, updates: Partial<StagingIdiom>) => void;
  handleDeleteIdiom: (id: string) => void;
  handleMarkdownChange: (newMd: string) => void;
  setCurrentStep: (step: 1 | 2 | 3 | 4) => void;
  handleApproveAndCommit: () => void;
}

export function ExtractionStep3Staging({
  stagingTitle,
  setStagingTitle,
  stagingWords,
  stagingIdioms,
  stagingMarkdown,
  setStagingMarkdown,
  step3ViewMode,
  setStep3ViewMode,
  copiedMarkdown,
  handleCopyMarkdown,
  handleDownloadMarkdown,
  stagingSearch,
  setStagingSearch,
  handleAddNewWord,
  handleAddNewIdiom,
  filteredWords,
  filteredIdioms,
  editingWordId,
  setEditingWordId,
  handleUpdateWord,
  handleDeleteWord,
  editingIdiomId,
  setEditingIdiomId,
  handleUpdateIdiom,
  handleDeleteIdiom,
  handleMarkdownChange,
  setCurrentStep,
  handleApproveAndCommit,
}: ExtractionStep3StagingProps) {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Header Title, Count & Action Controls */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <input
              type="text"
              value={stagingTitle}
              onChange={(e) => {
                setStagingTitle(e.target.value);
                const newMd = formatVocabToMarkdown({
                  title: e.target.value,
                  words: stagingWords,
                });
                setStagingMarkdown(newMd);
              }}
              placeholder="Core Vocabularies & Additional Words"
              className="font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-indigo-500 outline-none text-sm sm:text-base px-1 py-0.5 w-full max-w-md"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {stagingWords.length} Core Vocabularies
            </span>
            <span>• Single Document View</span>
          </div>
        </div>

        {/* View Mode & Export Actions */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Toggle Rendered vs Markdown */}
          <div className="flex items-center p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setStep3ViewMode('rendered')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                step3ViewMode === 'rendered'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Stylized Document View"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Document</span>
            </button>
            <button
              type="button"
              onClick={() => setStep3ViewMode('editor')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                step3ViewMode === 'editor'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Edit Raw Markdown"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Markdown</span>
            </button>
          </div>

          {/* Copy Markdown Button */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
              copiedMarkdown
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            title="Copy full vocabulary list in Markdown"
          >
            {copiedMarkdown ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Download Markdown Button */}
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="p-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
            title="Download as .md file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter Search Bar (when in Rendered View) */}
      {step3ViewMode === 'rendered' && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={stagingSearch}
              onChange={(e) => setStagingSearch(e.target.value)}
              placeholder="Filter words, meanings, or additional themes..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={handleAddNewWord}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Word</span>
          </button>
        </div>
      )}

      {/* Document Container */}
      {step3ViewMode === 'rendered' ? (
        <div className="p-4 sm:p-6 bg-white dark:bg-[#13141b] border border-slate-200 dark:border-slate-800 rounded-2xl max-h-[54vh] overflow-y-auto custom-scrollbar select-text space-y-6">
          {/* Clean Main Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg">
                {stagingTitle || 'Core Vocabularies & Additional Words'}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                💡 Click <span className="font-semibold text-indigo-600 dark:text-indigo-400">Edit</span> or double-click any card to modify definitions, themes, and examples.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={handleAddNewWord}
                className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3 h-3" />
                <span>Add Word</span>
              </button>
              <button
                type="button"
                onClick={handleAddNewIdiom}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Idiom</span>
              </button>
            </div>
          </div>

          {/* Vocabulary Word Cards */}
          {filteredWords.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No vocabulary items match your filter.
            </div>
          ) : (
            <div className="space-y-4 text-xs sm:text-sm leading-relaxed">
              {filteredWords.map((word) => (
                <StagingWordCard
                  key={word.id}
                  word={word}
                  isEditing={editingWordId === word.id}
                  onStartEdit={() => setEditingWordId(word.id)}
                  onSave={(updates) => handleUpdateWord(word.id, updates)}
                  onCancel={() => setEditingWordId(null)}
                  onDelete={() => handleDeleteWord(word.id)}
                />
              ))}
            </div>
          )}

          {/* Idioms & Phrases Section (if any present) */}
          {stagingIdioms.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                  Idioms & Phrases ({stagingIdioms.length})
                </div>
                <button
                  type="button"
                  onClick={handleAddNewIdiom}
                  className="px-2 py-0.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Idiom</span>
                </button>
              </div>
              <div className="space-y-2.5">
                {filteredIdioms.map((idiom) => (
                  <StagingIdiomCard
                    key={idiom.id}
                    idiom={idiom}
                    isEditing={editingIdiomId === idiom.id}
                    onStartEdit={() => setEditingIdiomId(idiom.id)}
                    onSave={(updates) => handleUpdateIdiom(idiom.id, updates)}
                    onCancel={() => setEditingIdiomId(null)}
                    onDelete={() => handleDeleteIdiom(idiom.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Raw Markdown Editor */
        <div className="space-y-2">
          <div className="relative">
            <textarea
              rows={14}
              value={stagingMarkdown}
              onChange={(e) => handleMarkdownChange(e.target.value)}
              placeholder="#### Core Vocabularies & Additional Words&#10;* **Debilitating (Adjective)**&#10;    * **Meaning:** ...&#10;    * **Synonyms:** ...&#10;    * **Antonyms:** ...&#10;    * **Additional:**&#10;        (weak): Feeble, Frail...&#10;    * **Example:** ..."
              className="w-full p-4 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed rounded-2xl border border-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 custom-scrollbar resize-y max-h-[52vh]"
              spellCheck={false}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            💡 Edits made in this Markdown editor synchronize directly with the parsed vocabulary entries and canvas commit.
          </p>
        </div>
      )}

      {/* Step 3 Bottom Action Controls */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setCurrentStep(2)}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Text</span>
        </button>
        <button
          type="button"
          onClick={handleApproveAndCommit}
          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Check className="w-4 h-4" />
          <span>
            Approve & Commit to Canvas ({stagingWords.length} Core Words)
          </span>
        </button>
      </div>
    </div>
  );
}
