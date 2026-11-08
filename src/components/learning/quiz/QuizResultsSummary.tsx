import React, { useState } from 'react';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertCircle,
  BookOpen,
  Check,
  RefreshCw,
} from 'lucide-react';
import type { QuizQuestion, VocabularyItem } from '../../../types';
import { useVocabularyStore } from '../../../store/vocabularyStore';
import { useQuizStore } from '../../../store/useQuizStore';

interface QuizResultsSummaryProps {
  quizTitle: string;
  passageText?: string;
  questions: QuizQuestion[];
  userAnswers: Record<string, number>;
  sourceWords: VocabularyItem[];
  onRestart: () => void;
  onClose: () => void;
}

export const QuizResultsSummary: React.FC<QuizResultsSummaryProps> = ({
  quizTitle,
  passageText,
  questions,
  userAnswers,
  sourceWords,
  onRestart,
  onClose,
}) => {
  const { addWrongVocabs, wrongVocabIds } = useVocabularyStore();
  const { retryMissedWords, isGenerating } = useQuizStore();

  const total = questions.length;
  let score = 0;
  const wrongQuestions: QuizQuestion[] = [];

  questions.forEach((q) => {
    if (userAnswers[q.id] === q.correctAnswerIndex) {
      score++;
    } else {
      wrongQuestions.push(q);
    }
  });

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  // Identify wrong vocabulary objects from sourceWords
  const wrongWords = wrongQuestions.map((q) => q.testedWord).filter(Boolean);

  const matchedWrongVocabs = sourceWords.filter((w) =>
    wrongWords.some((ww) => ww.toLowerCase() === w.word.toLowerCase())
  );

  // Fallback: if AI tested derived forms that didn't exact-match w.word, allow retrying all wrong questions' matched words or source subset
  const retryPool =
    matchedWrongVocabs.length > 0
      ? matchedWrongVocabs
      : wrongQuestions.length > 0
      ? sourceWords.slice(0, Math.min(sourceWords.length, wrongQuestions.length))
      : [];

  const allMissedAlreadyInWrong =
    matchedWrongVocabs.length > 0 &&
    matchedWrongVocabs.every((v) => wrongVocabIds.includes(v.id));

  const [savedToWrong, setSavedToWrong] = useState<boolean>(false);
  const [isSavingWrong, setIsSavingWrong] = useState<boolean>(false);

  const handleSaveToWrong = async () => {
    if (savedToWrong || allMissedAlreadyInWrong || matchedWrongVocabs.length === 0) return;
    setIsSavingWrong(true);
    try {
      await addWrongVocabs(matchedWrongVocabs.map((v) => v.id));
      setSavedToWrong(true);
    } catch (err) {
      console.error('Failed to save wrong words to Wrong list:', err);
    } finally {
      setIsSavingWrong(false);
    }
  };

  const renderCleanPassage = (raw: string) => {
    // Replace [Blank 1] with Bold numbered answers for easy review
    let counter = 0;
    const parts = raw.split(/(\[Blank\s*\d+\]|\(Blank\s*\d+\)|Blank\s*\d+)/gi);
    return parts.map((part, idx) => {
      const match = part.match(/(?:\[Blank\s*(\d+)\]|\(Blank\s*(\d+)\)|Blank\s*(\d+))/i);
      if (match) {
        counter++;
        const rawNum = match[1] || match[2] || match[3];
        const qIdx = rawNum ? parseInt(rawNum, 10) - 1 : counter - 1;
        const q = questions[qIdx] || questions[counter - 1];
        if (!q) return <span key={idx}>{part}</span>;
        const correctWord = q.options[q.correctAnswerIndex];
        const isUserRight = userAnswers[q.id] === q.correctAnswerIndex;
        return (
          <span
            key={idx}
            className={`inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md text-xs sm:text-sm font-bold tabular-nums ${
              isUserRight
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
            }`}
          >
            ({qIdx + 1}) {correctWord}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const renderQuestionList = () => (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
        Detailed Question Breakdown ({score}/{total} Correct)
      </h3>

      <div className="space-y-3">
        {questions.map((q, idx) => {
          const userIndex = userAnswers[q.id];
          const isCorrect = userIndex === q.correctAnswerIndex;

          return (
            <div
              key={q.id}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 tabular-nums">
                  Q{idx + 1}
                  {q.testedWord && (
                    <>
                      {' · '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {q.testedWord}
                      </strong>
                    </>
                  )}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold ${
                    isCorrect
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {isCorrect ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {isCorrect ? 'Correct' : 'Incorrect'}
                </span>
              </div>

              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {q.questionText}
              </p>

              <div className="text-xs space-y-1 pt-1">
                {!isCorrect && (
                  <p className="text-rose-600 dark:text-rose-400">
                    <strong>Your answer:</strong>{' '}
                    {typeof userIndex === 'number' ? q.options[userIndex] : 'Unanswered'}
                  </p>
                )}
                <p className="text-emerald-600 dark:text-emerald-400">
                  <strong>Correct answer:</strong> {q.options[q.correctAnswerIndex]}
                </p>
              </div>

              {q.explanation && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn mx-auto py-2">
      {/* Compact Score Header */}
      <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-b from-indigo-50/70 via-white to-white dark:from-slate-800/60 dark:via-slate-900 dark:to-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Trophy className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
              {quizTitle || 'Quiz Completed'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
              {percentage >= 80
                ? 'Outstanding grasp! Your active recall and contextual retention are strong.'
                : percentage >= 50
                ? 'Solid effort! Reviewing your missed words below will lock these into memory.'
                : 'Keep practicing! Contextual revision is where permanent retention happens.'}
            </p>
          </div>
        </div>

        <div className="text-center sm:text-right shrink-0 tabular-nums">
          <div className="text-4xl sm:text-5xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
            {score} <span className="text-xl text-slate-400 font-semibold">/ {total}</span>
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5">
            {percentage}% Accuracy
          </div>
        </div>
      </div>

      {/* Actionable Revision Bar: Retry Missed Words + Save to Wrong Tab */}
      {wrongQuestions.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200 tabular-nums">
                {wrongQuestions.length}{' '}
                {wrongQuestions.length === 1 ? 'Question Missed' : 'Questions Missed'}
              </h4>
              <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
                Re-test your missed words immediately or save them to your <strong>Wrong</strong> tab for focused revision.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
            {retryPool.length > 0 && (
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => retryMissedWords(retryPool)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 tabular-nums"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Retry Missed Words ({retryPool.length})</span>
              </button>
            )}

            {matchedWrongVocabs.length > 0 && (
              <button
                type="button"
                onClick={handleSaveToWrong}
                disabled={savedToWrong || allMissedAlreadyInWrong || isSavingWrong}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  savedToWrong || allMissedAlreadyInWrong
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/20 active:scale-95'
                }`}
              >
                {savedToWrong || allMissedAlreadyInWrong ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved in Wrong Tab</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Save to Wrong ({matchedWrongVocabs.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Side-by-Side Passage & Answer Review when passageText exists */}
      {passageText ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-4 p-5 sm:p-6 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3">
              <BookOpen className="w-4 h-4" />
              <span>Passage Reference</span>
            </div>
            <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line">
              {renderCleanPassage(passageText)}
            </div>
          </div>

          <div className="lg:col-span-7 max-h-[60vh] overflow-y-auto pr-1">
            {renderQuestionList()}
          </div>
        </div>
      ) : (
        <div className="max-h-[55vh] overflow-y-auto pr-1">{renderQuestionList()}</div>
      )}

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onRestart}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-300 transition"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Configure Another Quiz</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs transition"
        >
          Done & Close
        </button>
      </div>
    </div>
  );
};
