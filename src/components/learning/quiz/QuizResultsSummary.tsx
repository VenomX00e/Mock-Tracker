import React, { useState } from 'react';
import {
  Trophy,
  X,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Tag,
  Star,
  Sparkles,
  ArrowRight,
  BookOpen,
  Check,
} from 'lucide-react';
import type { QuizQuestion, VocabularyItem } from '../../../types';
import { useVocabularyStore } from '../../../store/vocabularyStore';

interface QuizResultsSummaryProps {
  quizTitle: string;
  questions: QuizQuestion[];
  userAnswers: Record<string, number>;
  sourceWords: VocabularyItem[];
  onRestart: () => void;
  onClose: () => void;
}

export const QuizResultsSummary: React.FC<QuizResultsSummaryProps> = ({
  quizTitle,
  questions,
  userAnswers,
  sourceWords,
  onRestart,
  onClose,
}) => {
  const { toggleFavorite, favoriteVocabIds, canvases } = useVocabularyStore();

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

  const percentage = Math.round((score / total) * 100);

  // Identify wrong vocabulary objects from sourceWords
  const wrongWords = wrongQuestions
    .map((q) => q.testedWord)
    .filter(Boolean);

  const matchedWrongVocabs = sourceWords.filter((w) =>
    wrongWords.some((ww) => ww.toLowerCase() === w.word.toLowerCase())
  );

  const [taggedHard, setTaggedHard] = useState<boolean>(false);
  const [isTagging, setIsTagging] = useState<boolean>(false);

  const handleTagAsFavorites = async () => {
    if (taggedHard || matchedWrongVocabs.length === 0) return;
    setIsTagging(true);
    try {
      for (const vocab of matchedWrongVocabs) {
        if (!favoriteVocabIds.includes(vocab.id)) {
          await toggleFavorite(vocab.id);
        }
      }
      setTaggedHard(true);
    } catch (err) {
      console.error('Failed to tag wrong words as favorites:', err);
    } finally {
      setIsTagging(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-2xl mx-auto py-4">
      {/* Score Card Header */}
      <div className="p-8 rounded-3xl bg-gradient-to-b from-indigo-50/70 via-white to-white dark:from-slate-800/60 dark:via-slate-900 dark:to-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-lg relative overflow-hidden">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <Trophy className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
          Quiz Completed!
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {quizTitle}
        </p>

        <div className="my-6">
          <div className="text-5xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
            {score} <span className="text-2xl text-slate-400 font-semibold">/ {total}</span>
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">
            {percentage}% Accuracy
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
          {percentage >= 80
            ? '🔥 Outstanding grasp! Your active recall and retention are strong.'
            : percentage >= 50
            ? '👍 Solid effort! Reviewing your missed words will solidify these in memory.'
            : '🌱 Keep practicing! Revision through context is where the real learning happens.'}
        </p>
      </div>

      {/* Smart Feature: Tag Wrong Words */}
      {matchedWrongVocabs.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {matchedWrongVocabs.length} Words Need Revision
              </h4>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                You missed {wrongQuestions.length} questions. Automatically star them for focused revision.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTagAsFavorites}
            disabled={taggedHard || isTagging}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              taggedHard
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20 active:scale-95'
            }`}
          >
            {taggedHard ? (
              <>
                <Check className="w-4 h-4" />
                <span>Starred to Favorites!</span>
              </>
            ) : (
              <>
                <Star className="w-4 h-4 fill-white" />
                <span>Tag as 'Hard' / Star</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Question Breakdown List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Detailed Question Breakdown
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
                  <span className="text-xs font-bold text-slate-500">
                    Q{idx + 1}: {q.testedWord && <strong className="text-slate-800 dark:text-slate-200">{q.testedWord}</strong>}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                      isCorrect
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {q.questionText}
                </p>

                <div className="text-xs space-y-1 pt-1">
                  {!isCorrect && typeof userIndex === 'number' && (
                    <p className="text-rose-600 dark:text-rose-400">
                      <strong>Your answer:</strong> {q.options[userIndex] || 'None'}
                    </p>
                  )}
                  <p className="text-emerald-600 dark:text-emerald-400">
                    <strong>Correct answer:</strong> {q.options[q.correctAnswerIndex]}
                  </p>
                </div>

                {q.explanation && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    💡 {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
