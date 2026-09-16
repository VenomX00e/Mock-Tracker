import React from 'react';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { QuizQuestion } from '../../../types';

interface SpotErrorRendererProps {
  question: QuizQuestion;
  questionIndex: number;
  totalQuestions: number;
  selectedIndex: number | undefined;
  onSelectAnswer: (chunkIndex: number) => void;
  showFeedback?: boolean;
}

export const SpotErrorRenderer: React.FC<SpotErrorRendererProps> = ({
  question,
  questionIndex,
  totalQuestions,
  selectedIndex,
  onSelectAnswer,
  showFeedback = false,
}) => {
  const hasAnswered = typeof selectedIndex === 'number';

  // Use either predefined chunks or options as the segments
  const chunks =
    question.sentenceChunks && question.sentenceChunks.length > 0
      ? question.sentenceChunks
      : question.options;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Prompt */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-full">
            Spot the Error • Q{questionIndex + 1} of {totalQuestions}
          </span>
          <span className="text-xs text-slate-500">
            Tap the segment containing the error
          </span>
        </div>

        <p className="text-sm md:text-base text-slate-600 dark:text-slate-300">
          The sentence below is divided into 4 parts. Identify which segment contains an error in vocabulary, phrasing, or grammar:
        </p>
      </div>

      {/* Clickable Sentence Chunks */}
      <div className="flex flex-col gap-3">
        {chunks.map((chunk, chunkIdx) => {
          const isSelected = selectedIndex === chunkIdx;
          const isCorrect = chunkIdx === question.correctAnswerIndex;

          let style =
            'border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200';

          if (hasAnswered) {
            if (isCorrect) {
              style =
                'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500';
            } else if (isSelected) {
              style =
                'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500';
            } else {
              style =
                'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-900 text-slate-400';
            }
          }

          return (
            <button
              key={chunkIdx}
              type="button"
              disabled={hasAnswered}
              onClick={() => onSelectAnswer(chunkIdx)}
              className={`p-4 md:p-5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between group active:scale-[0.99] ${style}`}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`mt-0.5 px-2.5 py-0.5 rounded-lg text-xs font-bold transition-colors ${
                    hasAnswered && isCorrect
                      ? 'bg-emerald-500 text-white'
                      : hasAnswered && isSelected
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-amber-500 group-hover:text-white'
                  }`}
                >
                  Part {String.fromCharCode(65 + chunkIdx)}
                </span>
                <span className="text-base font-medium leading-relaxed">
                  {chunk}
                </span>
              </div>

              {hasAnswered && (
                <div className="ml-3 shrink-0">
                  {isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : isSelected ? (
                    <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  ) : null}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
