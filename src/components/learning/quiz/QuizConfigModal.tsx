import React, { useState } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  FileQuestion,
  Search,
  CheckCircle2,
  ArrowRight,
  Layers,
  Settings2,
  HelpCircle,
  Wand2,
} from 'lucide-react';
import type { QuizFormat, QuizConfig, VocabularyItem } from '../../../types';

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
  badge: string;
  description: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'cloze',
    label: 'Cloze Test',
    badge: 'Passage Blanks',
    description: 'A cohesive story/article with inline dropdown blanks to test contextual word usage.',
  },
  {
    id: 'fillers',
    label: 'Sentence Fillers',
    badge: 'Single Sentence',
    description: 'Precision test with sentences requiring the exact right vocab word or nuance.',
  },
  {
    id: 'synonyms_antonyms',
    label: 'Synonyms & Antonyms',
    badge: 'Direct Pairs',
    description: 'Tests exact vocabulary definitions, direct counterparts, and related opposites.',
  },
  {
    id: 'spot_error',
    label: 'Spot the Error',
    badge: 'Syntax & Error',
    description: 'Clickable segments where one part uses the vocab or syntax incorrectly.',
  },
  {
    id: 'reading_comprehension',
    label: 'Reading Comprehension',
    badge: 'Passage Q&A',
    description: 'Full narrative passage with contextual questions testing your comprehension.',
  },
  {
    id: 'mixed',
    label: 'Mixed Mock Challenge',
    badge: 'Exam Simulation',
    description: 'A diverse combination of fillers, synonyms, and error-spotting questions.',
  },
];

export const QuizConfigModal: React.FC<QuizConfigModalProps> = ({
  isOpen,
  onClose,
  sourceWords,
  onStartGeneration,
  isGenerating = false,
}) => {
  const [format, setFormat] = useState<QuizFormat>('cloze');
  const [theme, setTheme] = useState<string>('');
  const [scope, setScope] = useState<'strict' | 'expanded'>('strict');

  if (!isOpen) return null;

  const sampleCount = Math.min(sourceWords.length, 20);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartGeneration({
      sourceWords,
      format,
      theme: theme.trim(),
      scope,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div
        id="quiz-config-modal"
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Configure AI Vocab Quiz
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {sourceWords.length > 20 ? (
                  <>
                    Randomly sampling <span className="font-semibold text-indigo-600 dark:text-indigo-400">20 words</span> out of {sourceWords.length} to ensure optimal AI speed & quality
                  </>
                ) : (
                  <>
                    Testing <span className="font-semibold text-indigo-600 dark:text-indigo-400">{sampleCount} words</span> from your current view
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section A: Format Selectors */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              1. Choose Practice Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FORMAT_OPTIONS.map((item) => {
                const isSelected = format === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFormat(item.id)}
                    className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-sm font-semibold ${
                          isSelected
                            ? 'text-indigo-900 dark:text-indigo-200'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isSelected
                            ? 'bg-indigo-200/60 dark:bg-indigo-800/60 text-indigo-700 dark:text-indigo-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section B: Custom Theme / Textbox */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="quiz-theme-input"
                className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                2. Custom Theme or Instructions (Optional)
              </label>
              <span className="text-[11px] text-slate-400">Pills work with or without this</span>
            </div>
            <textarea
              id="quiz-theme-input"
              rows={2}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. 'Make it an editorial about renewable energy' or 'Include financial and banking scenarios' or 'Write a sci-fi narrative'"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 resize-none transition"
            />
          </div>

          {/* Section C: Vocabulary Scope */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              3. Vocabulary Scope
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                onClick={() => setScope('strict')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  scope === 'strict'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="quiz-scope"
                  checked={scope === 'strict'}
                  onChange={() => setScope('strict')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Strict Mode
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Test only my exact saved target words as the correct answers.
                  </span>
                </div>
              </label>

              <label
                onClick={() => setScope('expanded')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  scope === 'expanded'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="quiz-scope"
                  checked={scope === 'expanded'}
                  onChange={() => setScope('expanded')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Expanded Mode
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Include advanced synonyms, antonyms, and related secondary vocabulary.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isGenerating}
            id="start-quiz-generation-btn"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Quiz ✨</span>
          </button>
        </div>
      </div>
    </div>
  );
};
