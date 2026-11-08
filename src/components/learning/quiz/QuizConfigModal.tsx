import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Wand2,
  AlertCircle,
  Layers,
} from 'lucide-react';
import type { QuizFormat, QuizConfig, VocabularyItem } from '../../../types';
import { useVocabularyStore } from '../../../store/vocabularyStore';

interface QuizConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceWords: VocabularyItem[];
  onStartGeneration: (config: QuizConfig) => void;
  isGenerating?: boolean;
}

interface FormatOption {
  id: QuizFormat;
  label: string;
  meta: string;
  description: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'cloze',
    label: 'Cloze Test',
    meta: 'Passage Blanks',
    description: 'Cohesive editorial passage with inline blanks testing contextual usage.',
  },
  {
    id: 'fillers',
    label: 'Sentence Fillers',
    meta: 'Single Sentence',
    description: 'Precision sentences requiring the exact right vocabulary word or nuance.',
  },
  {
    id: 'synonyms_antonyms',
    label: 'Synonyms & Antonyms',
    meta: 'Direct Pairs',
    description: 'Tests exact definitions, direct counterparts, and contextual opposites.',
  },
  {
    id: 'spot_error',
    label: 'Spot the Error',
    meta: 'Syntax & Usage',
    description: '4-part sentence segments where one part uses vocabulary or grammar Phrasing wrong.',
  },
  {
    id: 'reading_comprehension',
    label: 'Reading Comprehension',
    meta: 'Passage Q&A',
    description: 'Side-by-side narrative passage with inference and vocabulary-in-context questions.',
  },
  {
    id: 'mixed',
    label: 'Mixed Mock Challenge',
    meta: 'Exam Simulation',
    description: 'Balanced combination of sentence fillers, synonyms, and error-spotting items.',
  },
];

const QUESTION_COUNTS: Array<5 | 10 | 15 | 20> = [5, 10, 15, 20];

export const QuizConfigModal: React.FC<QuizConfigModalProps> = ({
  isOpen,
  onClose,
  sourceWords,
  onStartGeneration,
  isGenerating = false,
}) => {
  const { wrongVocabIds, favoritedVocabsData } = useVocabularyStore();

  const [format, setFormat] = useState<QuizFormat>('cloze');
  const [theme, setTheme] = useState<string>('');
  const [scope, setScope] = useState<'strict' | 'expanded'>('strict');
  const [questionCount, setQuestionCount] = useState<5 | 10 | 15 | 20>(5);
  const [wordPool, setWordPool] = useState<'all' | 'wrong'>('all');

  // Resolve Wrong words from either current sourceWords or full favoritedVocabsData
  const wrongWords = React.useMemo(() => {
    const wrongSet = new Set(wrongVocabIds);
    const fromSource = sourceWords.filter((w) => wrongSet.has(w.id));
    if (fromSource.length > 0) return fromSource;
    return favoritedVocabsData.filter((w) => wrongSet.has(w.id));
  }, [sourceWords, wrongVocabIds, favoritedVocabsData]);

  useEffect(() => {
    if (wordPool === 'wrong' && wrongWords.length === 0) {
      setWordPool('all');
    }
  }, [wordPool, wrongWords.length]);

  if (!isOpen || typeof document === 'undefined') return null;

  const effectiveWords =
    wordPool === 'wrong' && wrongWords.length > 0 ? wrongWords : sourceWords;
  const sampleLimit = Math.max(20, questionCount);
  const activePoolCount = Math.min(effectiveWords.length, sampleLimit);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveWords.length === 0) return;
    onStartGeneration({
      sourceWords: effectiveWords,
      format,
      theme: theme.trim(),
      scope,
      questionCount,
      wordPool,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div
        id="quiz-config-modal"
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                Configure AI Vocab Quiz
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Testing{' '}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {activePoolCount} {activePoolCount === 1 ? 'word' : 'words'}
                </span>{' '}
                from {wordPool === 'wrong' ? 'Wrong list' : 'current view'} ·{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {questionCount} questions
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Top Bar: Word Pool Filter & Question Count */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            {/* Word Pool Filter */}
            <div className="sm:col-span-7 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Word Pool
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setWordPool('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all tabular-nums ${
                    wordPool === 'all'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Current View ({sourceWords.length})</span>
                </button>
                <button
                  type="button"
                  disabled={wrongWords.length === 0}
                  onClick={() => setWordPool('wrong')}
                  title={
                    wrongWords.length === 0
                      ? 'No words saved in your Wrong list yet'
                      : 'Test only words from your Wrong list'
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all tabular-nums ${
                    wordPool === 'wrong'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : wrongWords.length === 0
                      ? 'bg-slate-100 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600 border-slate-200/60 dark:border-slate-800 cursor-not-allowed'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-400'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Wrong ({wrongWords.length})</span>
                </button>
              </div>
            </div>

            {/* Question Count Selector */}
            <div className="sm:col-span-5 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Questions
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {QUESTION_COUNTS.map((count) => {
                  const active = questionCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setQuestionCount(count)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition-all tabular-nums ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 1: Practice Format */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              1. Practice Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((item) => {
                const isSelected = format === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFormat(item.id)}
                    className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span
                        className={`text-xs sm:text-sm font-bold ${
                          isSelected
                            ? 'text-indigo-900 dark:text-indigo-200'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
                        · {item.meta}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2 & 3 Combined: Vocabulary Scope + Custom Theme */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
            {/* Vocabulary Scope */}
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                2. Vocabulary Scope
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setScope('strict')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    scope === 'strict'
                      ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300'
                  }`}
                >
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Strict
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    Saved words only
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('expanded')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    scope === 'expanded'
                      ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300'
                  }`}
                >
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Expanded
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    + Related & synonyms
                  </span>
                </button>
              </div>
            </div>

            {/* Custom Theme Input */}
            <div className="sm:col-span-7">
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="quiz-theme-input"
                  className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                >
                  3. Custom Theme (Optional)
                </label>
              </div>
              <input
                id="quiz-theme-input"
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g. Banking & finance editorial, geopolitics, sci-fi..."
                className="w-full h-[54px] px-3.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 transition"
              />
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isGenerating || effectiveWords.length === 0}
            id="start-quiz-generation-btn"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate {questionCount}-Question Quiz</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
