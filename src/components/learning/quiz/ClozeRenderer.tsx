import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, ChevronDown, Check } from 'lucide-react';
import type { QuizQuestion } from '../../../types';

interface ClozeRendererProps {
  passageText: string;
  questions: QuizQuestion[];
  userAnswers: Record<string, number>;
  onSelectAnswer: (questionId: string, optionIndex: number) => void;
  isSubmitted: boolean;
}

interface InlineBlankProps {
  blankNumber: number;
  question: QuizQuestion;
  selectedOptionIndex: number | undefined;
  onSelect: (optionIndex: number) => void;
  isSubmitted: boolean;
}

const InlineBlankDropdown: React.FC<InlineBlankProps> = ({
  blankNumber,
  question,
  selectedOptionIndex,
  onSelect,
  isSubmitted,
}) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 200,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasAnswered = typeof selectedOptionIndex === 'number';
  const isCorrect = hasAnswered && selectedOptionIndex === question.correctAnswerIndex;
  // Instant Practice Mode: lock blank once user selects an answer
  const isLocked = hasAnswered || isSubmitted;

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const minWidth = Math.max(rect.width, 190);
    const maxLeft = window.innerWidth - minWidth - 12;
    setMenuPos({
      top: rect.bottom + 6,
      left: Math.max(12, Math.min(rect.left, maxLeft)),
      width: minWidth,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleScrollOrResize = () => updatePosition();

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  if (hasAnswered) {
    const chosenWord = question.options[selectedOptionIndex!] || 'Selected';
    const correctWord = question.options[question.correctAnswerIndex];

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 mx-1 my-0.5 rounded-lg text-sm font-semibold border align-baseline tabular-nums ${
          isCorrect
            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-500/15 border-rose-500/50 text-rose-700 dark:text-rose-300'
        }`}
      >
        <span className="text-xs opacity-70">({blankNumber})</span>
        {isCorrect ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{chosenWord}</span>
          </>
        ) : (
          <>
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="line-through opacity-75">{chosenWord}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              → {correctWord}
            </span>
          </>
        )}
      </span>
    );
  }

  return (
    <span className="inline-block mx-1 my-0.5 align-baseline">
      <button
        ref={buttonRef}
        type="button"
        disabled={isLocked}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm font-semibold border border-indigo-300 dark:border-indigo-700 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all shadow-sm cursor-pointer tabular-nums"
      >
        <span>({blankNumber}) Select word</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              top: menuPos.top,
              left: menuPos.left,
              minWidth: menuPos.width,
            }}
            className="fixed z-[9999] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl py-1.5 overflow-hidden animate-fadeIn"
          >
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
              Blank #{blankNumber} Options
            </div>
            {question.options.map((option, optIdx) => (
              <button
                key={optIdx}
                type="button"
                onClick={() => {
                  onSelect(optIdx);
                  setOpen(false);
                }}
                className="w-full px-3.5 py-2 text-left text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center justify-between gap-2 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                    {String.fromCharCode(65 + optIdx)}.
                  </span>
                  <span>{option}</span>
                </span>
                <Check className="w-3.5 h-3.5 opacity-0" />
              </button>
            ))}
          </div>,
          document.body
        )}
    </span>
  );
};

export const ClozeRenderer: React.FC<ClozeRendererProps> = ({
  passageText,
  questions,
  userAnswers,
  onSelectAnswer,
  isSubmitted,
}) => {
  const parts = passageText.split(/(\[Blank\s*\d+\]|\(Blank\s*\d+\)|Blank\s*\d+)/gi);
  let blankCounter = 0;

  const answeredItems = questions
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => typeof userAnswers[q.id] === 'number' || isSubmitted);

  return (
    <div className="space-y-6">
      {/* Interactive Cloze Passage Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm leading-loose text-base md:text-lg text-slate-800 dark:text-slate-200">
        {parts.map((part, index) => {
          const match = part.match(/(?:\[Blank\s*(\d+)\]|\(Blank\s*(\d+)\)|Blank\s*(\d+))/i);
          if (match) {
            blankCounter++;
            const rawNum = match[1] || match[2] || match[3];
            const parsedIndex = rawNum ? parseInt(rawNum, 10) - 1 : blankCounter - 1;
            const questionIndex =
              parsedIndex >= 0 && parsedIndex < questions.length
                ? parsedIndex
                : blankCounter - 1;
            const question = questions[questionIndex];

            if (!question) {
              return (
                <span key={index} className="font-bold underline text-indigo-500">
                  {part}
                </span>
              );
            }

            return (
              <InlineBlankDropdown
                key={`${question.id}-${index}`}
                blankNumber={questionIndex + 1}
                question={question}
                selectedOptionIndex={userAnswers[question.id]}
                onSelect={(optIdx) => onSelectAnswer(question.id, optIdx)}
                isSubmitted={isSubmitted}
              />
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </div>

      {/* Zero-Spoiler Instant Blank Verification & Feedback */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Instant Blank Feedback ({answeredItems.length}/{questions.length} Answered)
          </h4>
        </div>

        {answeredItems.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400 text-center">
            Select a word for any inline blank above to reveal instant verification and contextual explanation.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {answeredItems.map(({ q, index: idx }) => {
              const userIndex = userAnswers[q.id];
              const isCorrect = userIndex === q.correctAnswerIndex;

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-xl border transition-all animate-fadeIn ${
                    isCorrect
                      ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                      Blank #{idx + 1} ·{' '}
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {q.options[q.correctAnswerIndex]}
                      </span>
                    </span>
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
                  </div>

                  {!isCorrect && typeof userIndex === 'number' && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mb-1">
                      Your choice: <span className="font-semibold">{q.options[userIndex]}</span>
                    </p>
                  )}

                  {q.explanation && (
                    <p className="mt-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
