import React from 'react';
import { CheckCircle2, XCircle, ChevronDown, HelpCircle } from 'lucide-react';
import type { QuizQuestion } from '../../../types';

interface ClozeRendererProps {
  passageText: string;
  questions: QuizQuestion[];
  userAnswers: Record<string, number>;
  onSelectAnswer: (questionId: string, optionIndex: number) => void;
  isSubmitted: boolean;
}

export const ClozeRenderer: React.FC<ClozeRendererProps> = ({
  passageText,
  questions,
  userAnswers,
  onSelectAnswer,
  isSubmitted,
}) => {
  // Regex to match [Blank 1], [Blank 2], (Blank 1), etc.
  const parts = passageText.split(/(\[Blank\s*\d+\]|\(Blank\s*\d+\)|Blank\s*\d+)/gi);

  let blankCounter = 0;

  return (
    <div className="space-y-6">
      {/* Interactive Cloze Passage Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm leading-relaxed text-base md:text-lg text-slate-800 dark:text-slate-200">
        {parts.map((part, index) => {
          const match = part.match(/(?:\[Blank\s*(\d+)\]|\(Blank\s*(\d+)\)|Blank\s*(\d+))/i);
          if (match) {
            blankCounter++;
            const questionIndex = blankCounter - 1;
            const question = questions[questionIndex];

            if (!question) {
              return <span key={index} className="font-bold underline text-indigo-500">{part}</span>;
            }

            const selectedOptionIndex = userAnswers[question.id];
            const hasAnswered = typeof selectedOptionIndex === 'number';
            const isCorrect = hasAnswered && selectedOptionIndex === question.correctAnswerIndex;

            return (
              <span key={question.id} className="inline-block mx-1 my-1 align-baseline">
                <select
                  aria-label={`Select answer for Blank ${blankCounter}`}
                  disabled={isSubmitted}
                  value={hasAnswered ? selectedOptionIndex : ''}
                  onChange={(e) => onSelectAnswer(question.id, parseInt(e.target.value, 10))}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 ${
                    !hasAnswered
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                      : !isSubmitted
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : isCorrect
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-rose-500 text-white border-rose-500'
                  }`}
                >
                  <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                    ({blankCounter}) Select word...
                  </option>
                  {question.options.map((option, optIdx) => (
                    <option
                      key={optIdx}
                      value={optIdx}
                      className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 py-1"
                    >
                      {option} {isSubmitted && optIdx === question.correctAnswerIndex ? '✓ (Correct)' : ''}
                    </option>
                  ))}
                </select>
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </div>

      {/* Individual Question Status / Drill-down for explanations */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Blank Verification & Feedback
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {questions.map((q, idx) => {
            const userIndex = userAnswers[q.id];
            const hasAnswered = typeof userIndex === 'number';
            const isCorrect = hasAnswered && userIndex === q.correctAnswerIndex;

            return (
              <div
                key={q.id}
                className={`p-4 rounded-xl border transition-all ${
                  !hasAnswered
                    ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40'
                    : isCorrect
                    ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Blank #{idx + 1}: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{q.testedWord}</span>
                  </span>
                  {hasAnswered && (
                    <span className="flex items-center gap-1 text-xs font-semibold">
                      {isCorrect ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Incorrect
                        </span>
                      )}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Target:</span> {q.options[q.correctAnswerIndex]}
                </p>

                {hasAnswered && q.explanation && (
                  <p className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    💡 {q.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
