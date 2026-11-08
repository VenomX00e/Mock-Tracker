import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  BookOpen,
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
    setCurrentQuestionIndex,
    nextQuestion,
    prevQuestion,
    submitQuiz,
    resetQuizSession,
    closeQuiz,
  } = useQuizStore();

  if (!activeQuiz || typeof document === 'undefined') return null;

  const questions = activeQuiz.questions || [];
  const total = questions.length;
  const currentQuestion = questions[currentQuestionIndex];
  const format = activeConfig?.format || 'cloze';

  const answeredCount = Object.keys(userAnswers).length;
  const isAllAnswered =
    questions.length > 0 &&
    questions.every((q) => typeof userAnswers[q.id] === 'number');

  if (isSubmitted) {
    return createPortal(
      <div className="fixed inset-0 z-[9990] overflow-y-auto p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md flex items-center justify-center animate-fadeIn">
        <div
          className={`w-full ${
            activeQuiz.passageText ? 'max-w-5xl' : 'max-w-3xl'
          } bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto`}
        >
          <QuizResultsSummary
            quizTitle={activeQuiz.quizTitle}
            passageText={activeQuiz.passageText}
            questions={questions}
            userAnswers={userAnswers}
            sourceWords={sourceWords}
            onRestart={resetQuizSession}
            onClose={closeQuiz}
          />
        </div>
      </div>,
      document.body
    );
  }

  const currentAnswer = currentQuestion ? userAnswers[currentQuestion.id] : undefined;
  const hasAnsweredCurrent = typeof currentAnswer === 'number';
  const isCurrentCorrect =
    currentQuestion &&
    hasAnsweredCurrent &&
    currentAnswer === currentQuestion.correctAnswerIndex;

  // Determine if current question is a Spot-the-Error question (either pure spot_error mode or mixed mode with sentenceChunks)
  const isSpotErrorQuestion =
    format === 'spot_error' ||
    Boolean(currentQuestion?.sentenceChunks && currentQuestion.sentenceChunks.length >= 2);

  const isReadingComprehension =
    format === 'reading_comprehension' && Boolean(activeQuiz.passageText);

  const renderQuestionAndExplanation = () => (
    <div className="space-y-5">
      {currentQuestion && isSpotErrorQuestion ? (
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

      {/* Instant Practice Mode Explanation Drawer */}
      {currentQuestion && hasAnsweredCurrent && (
        <div
          className={`p-4 md:p-5 rounded-2xl border transition-all duration-200 animate-fadeIn ${
            isCurrentCorrect
              ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30'
              : 'border-rose-200 dark:border-rose-800/80 bg-rose-50/70 dark:bg-rose-950/30'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                isCurrentCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
              }`}
            >
              {isCurrentCorrect ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
            </div>
            <div>
              <h4
                className={`text-sm font-bold ${
                  isCurrentCorrect
                    ? 'text-emerald-900 dark:text-emerald-200'
                    : 'text-rose-900 dark:text-rose-200'
                }`}
              >
                {isCurrentCorrect
                  ? 'Correct Answer'
                  : `Incorrect · Correct Answer: ${
                      currentQuestion.options[currentQuestion.correctAnswerIndex]
                    }`}
              </h4>
              {currentQuestion.explanation && (
                <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                  {currentQuestion.explanation}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9990] overflow-y-auto bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-md flex flex-col justify-between animate-fadeIn">
      {/* Top Navbar */}
      <header className="w-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate">
            {activeQuiz.quizTitle || 'AI Vocabulary Quiz'}
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize tabular-nums">
            {format.replace('_', ' ')} · {answeredCount}/{total} Answered
          </p>
        </div>

        {/* Interactive Question Number Jumper (for non-cloze formats) */}
        {format !== 'cloze' && total > 1 && (
          <div className="hidden md:flex items-center gap-1.5 overflow-x-auto max-w-md py-1">
            {questions.map((q, idx) => {
              const ans = userAnswers[q.id];
              const isAns = typeof ans === 'number';
              const isRight = isAns && ans === q.correctAnswerIndex;
              const isActive = idx === currentQuestionIndex;

              let btnClass =
                'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:border-slate-300';
              if (isAns) {
                btnClass = isRight
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40';
              }
              if (isActive) {
                btnClass += ' ring-2 ring-indigo-500 font-bold';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-7 h-7 rounded-lg text-xs border transition-all flex items-center justify-center shrink-0 tabular-nums ${btnClass}`}
                  title={`Jump to Question ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {answeredCount > 0 && (
            <button
              type="button"
              onClick={submitQuiz}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition tabular-nums"
            >
              <span>Finish ({answeredCount}/{total})</span>
            </button>
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
      <main
        className={`flex-1 w-full ${
          isReadingComprehension ? 'max-w-6xl' : 'max-w-4xl'
        } mx-auto p-4 sm:p-6 md:p-8 flex flex-col justify-center`}
      >
        {format === 'cloze' && activeQuiz.passageText ? (
          <ClozeRenderer
            passageText={activeQuiz.passageText}
            questions={questions}
            userAnswers={userAnswers}
            onSelectAnswer={(qId, optIdx) => selectAnswer(qId, optIdx)}
            isSubmitted={isSubmitted}
          />
        ) : isReadingComprehension ? (
          /* Two-Zone Split Layout for Reading Comprehension */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Sticky/Scrollable Reading Passage */}
            <div className="lg:col-span-6 lg:sticky lg:top-20 p-6 md:p-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm max-h-[42vh] lg:max-h-[70vh] overflow-y-auto">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3">
                <BookOpen className="w-4 h-4" />
                <span>Reading Passage</span>
              </div>
              <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line">
                {activeQuiz.passageText}
              </div>
            </div>

            {/* Right Column: Active Question & Instant Feedback */}
            <div className="lg:col-span-6">{renderQuestionAndExplanation()}</div>
          </div>
        ) : (
          renderQuestionAndExplanation()
        )}
      </main>

      {/* Bottom Sticky Footer */}
      <footer className="w-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 sticky bottom-0 z-10">
        <div
          className={`${
            isReadingComprehension ? 'max-w-6xl' : 'max-w-4xl'
          } mx-auto flex items-center justify-between`}
        >
          {format === 'cloze' ? (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs text-slate-500 tabular-nums">
                {answeredCount} of {total} blanks completed
              </span>
              <button
                type="button"
                onClick={submitQuiz}
                disabled={answeredCount === 0}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-sm ${
                  isAllAnswered
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shadow-indigo-500/20'
                    : answeredCount > 0
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 hover:opacity-90'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>{isAllAnswered ? 'View Final Summary' : 'Finish & View Summary'}</span>
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
                    disabled={answeredCount === 0}
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-sm shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                  >
                    <span>View Results Summary</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>,
    document.body
  );
};
