import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { QuizQuestion } from '../../../types';

interface StandardMCQRendererProps {
  question: QuizQuestion;
  questionIndex: number;
  totalQuestions: number;
  selectedIndex: number | undefined;
  onSelectAnswer: (optionIndex: number) => void;
  showFeedback?: boolean;
}

export const StandardMCQRenderer: React.FC<StandardMCQRendererProps> = ({
  question,
  questionIndex,
  totalQuestions,
  selectedIndex,
  onSelectAnswer,
}) => {
  const hasAnswered = typeof selectedIndex === 'number';

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Question Prompt Card */}
      <div className="p-6 md:p-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 tabular-nums">
            Question {questionIndex + 1} of {totalQuestions}
          </span>
          {hasAnswered && question.testedWord && (
            <span className="text-xs text-slate-500 dark:text-slate-400 animate-fadeIn">
              Tested Word: <strong className="text-slate-800 dark:text-slate-200">{question.testedWord}</strong>
            </span>
          )}
        </div>

        <h3 className="text-base sm:text-lg md:text-xl font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
          {question.questionText}
        </h3>
      </div>

      {/* 4 Interactive Option Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {question.options.map((option, optIdx) => {
          const isSelected = selectedIndex === optIdx;
          const isCorrect = optIdx === question.correctAnswerIndex;

          let cardStyle =
            'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm hover:shadow-md';

          if (hasAnswered) {
            if (isCorrect) {
              cardStyle =
                'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500';
            } else if (isSelected) {
              cardStyle =
                'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500';
            } else {
              cardStyle =
                'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-900 text-slate-400';
            }
          }

          return (
            <button
              key={optIdx}
              type="button"
              disabled={hasAnswered}
              onClick={() => onSelectAnswer(optIdx)}
              className={`p-4 md:p-5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between group active:scale-[0.98] ${cardStyle}`}
            >
              <div className="flex items-center gap-3.5">
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-colors shrink-0 ${
                    hasAnswered && isCorrect
                      ? 'bg-emerald-500 text-white'
                      : hasAnswered && isSelected
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'
                  }`}
                >
                  {String.fromCharCode(65 + optIdx)}
                </span>
                <span className="text-sm md:text-base font-semibold leading-snug">
                  {option}
                </span>
              </div>

              {hasAnswered && (
                <div className="ml-2 shrink-0">
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
