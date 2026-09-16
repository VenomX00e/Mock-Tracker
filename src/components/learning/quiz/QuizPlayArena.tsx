import React, { useState } from 'react';
import {
  X,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useQuizStore } from '../../../store/useQuizStore';
import { ClozeRenderer } from './ClozeRenderer';
import { StandardMCQRenderer } from './StandardMCQRenderer';
import { SpotErrorRenderer } from './SpotErrorRenderer';
import { QuizResultsSummary } from './QuizResultsSummary';

export const QuizPlayArena: React.FC = () => {
  const {
    activeQuiz,
    activeConfig,
    currentQuestionIndex,
    userAnswers,
    isSubmitted,
    sourceWords,
    selectAnswer,
    nextQuestion,
    prevQuestion,
    submitQuiz,
    resetQuizSession,
    closeQuiz,
  } = useQuizStore();

  const [showExplanationDrawer] = useState<boolean>(true);

  if (!activeQuiz) return null;

  const questions = activeQuiz.questions || [];
  const total = questions.length;
  const currentQuestion = questions[currentQuestionIndex];
  const format = activeConfig?.format || 'cloze';

  const isAllAnswered =
    questions.length > 0 &&
    questions.every((q) => typeof userAnswers[q.id] === 'number');

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md flex items-center justify-center animate-fadeIn">
        <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto">
          <QuizResultsSummary
            quizTitle={activeQuiz.quizTitle}
            questions={questions}
            userAnswers={userAnswers}
            sourceWords={sourceWords}
            onRestart={resetQuizSession}
            onClose={closeQuiz}
          />
        </div>
      </div>
    );
  }

  // Answer state for current question
  const currentAnswer = currentQuestion ? userAnswers[currentQuestion.id] : undefined;
  const hasAnsweredCurrent = typeof currentAnswer === 'number';
  const isCurrentCorrect =
    currentQuestion && hasAnsweredCurrent && currentAnswer === currentQuestion.correctAnswerIndex;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-100/90 dark:bg-slate-950/90 backdrop-blur-md flex flex-col justify-between animate-fadeIn">
      {/* Top Navbar */}
      <header className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px] sm:max-w-md">
              {activeQuiz.quizTitle || 'AI Vocabulary Quiz'}
            </h1>
            <p className="text-[11px] text-slate-400 capitalize">
              Mode: {format.replace('_', ' ')} • {questions.length} Questions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress Bar (MCQ/Spot) */}
          {format !== 'cloze' && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-32 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{
                    width: `${((Object.keys(userAnswers).length) / Math.max(1, total)) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {Object.keys(userAnswers).length}/{total}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={closeQuiz}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Exit Quiz"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col justify-center">
        {format === 'cloze' && activeQuiz.passageText ? (
          <ClozeRenderer
            passageText={activeQuiz.passageText}
            questions={questions}
            userAnswers={userAnswers}
            onSelectAnswer={(qId, optIdx) => selectAnswer(qId, optIdx)}
            isSubmitted={isSubmitted}
          />
        ) : format === 'spot_error' && currentQuestion ? (
          <SpotErrorRenderer
            question={currentQuestion}
            questionIndex={currentQuestionIndex}
            totalQuestions={total}
            selectedIndex={currentAnswer}
            onSelectAnswer={(chunkIdx) => selectAnswer(currentQuestion.id, chunkIdx)}
            showFeedback={hasAnsweredCurrent}
          />
        ) : currentQuestion ? (
          <StandardMCQRenderer
            question={currentQuestion}
            questionIndex={currentQuestionIndex}
            totalQuestions={total}
            selectedIndex={currentAnswer}
            onSelectAnswer={(optIdx) => selectAnswer(currentQuestion.id, optIdx)}
            showFeedback={hasAnsweredCurrent}
          />
        ) : null}

        {/* Dynamic Explanation Drawer for Non-Cloze formats */}
        {format !== 'cloze' && currentQuestion && hasAnsweredCurrent && showExplanationDrawer && (
          <div
            className={`mt-6 p-4 md:p-5 rounded-2xl border transition-all duration-300 animate-slideUp ${
              isCurrentCorrect
                ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30'
                : 'border-rose-200 dark:border-rose-800/80 bg-rose-50/70 dark:bg-rose-950/30'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-xl mt-0.5 ${
                    isCurrentCorrect
                      ? 'bg-emerald-500 text-white'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {isCurrentCorrect ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                </div>
                <div>
                  <h4
                    className={`text-sm font-bold ${
                      isCurrentCorrect
                        ? 'text-emerald-900 dark:text-emerald-200'
                        : 'text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    {isCurrentCorrect ? 'Spot on! Correct answer.' : 'Incorrect.'}
                  </h4>
                  <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Sticky Footer */}
      <footer className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-6 py-4 sticky bottom-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {format === 'cloze' ? (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {Object.keys(userAnswers).length} of {total} blanks filled
              </span>
              <button
                type="button"
                onClick={submitQuiz}
                disabled={!isAllAnswered}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-sm ${
                  isAllAnswered
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shadow-indigo-500/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Submit & View Results</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                disabled={currentQuestionIndex === 0}
                onClick={prevQuestion}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  currentQuestionIndex > 0
                    ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-2">
                {currentQuestionIndex < total - 1 ? (
                  <button
                    type="button"
                    onClick={nextQuestion}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm shadow-indigo-500/20 active:scale-95"
                  >
                    <span>Next Question</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitQuiz}
                    disabled={!hasAnsweredCurrent}
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-sm shadow-emerald-500/20 active:scale-95"
                  >
                    <span>Submit & Finish</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};
