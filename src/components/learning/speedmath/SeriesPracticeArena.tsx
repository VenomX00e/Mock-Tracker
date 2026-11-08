import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Timer,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Award,
  ChevronRight,
  X,
} from 'lucide-react';
import { SeriesPattern, SeriesPracticeLevel, SeriesQuestion } from '../../../types/seriesTypes';
import { generateSeriesQuestion, BUILTIN_EXAM_PATTERNS } from '../../../utils/seriesEngine';
import { VirtualNumpad } from '../VirtualNumpad';

interface SeriesPracticeArenaProps {
  pattern: SeriesPattern | 'ALL';
  availablePatterns: SeriesPattern[];
  level: SeriesPracticeLevel;
  onClose: () => void;
  onSwitchLevel?: (newLevel: SeriesPracticeLevel) => void;
}

interface QuestionAttempt {
  question: SeriesQuestion;
  userAnswer: number | string;
  isCorrect: boolean;
  timeSpentMs: number;
}

export function SeriesPracticeArena({
  pattern,
  availablePatterns,
  level,
  onClose,
  onSwitchLevel,
}: SeriesPracticeArenaProps) {
  const TOTAL_QUESTIONS = 5;

  // Session state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<SeriesQuestion | null>(null);
  const [seriesTypeFilter, setSeriesTypeFilter] = useState<'missing' | 'wrong' | 'mixed'>('missing');
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [history, setHistory] = useState<QuestionAttempt[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Timing
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const qStartTimeRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Pick pattern for this question (supports 'ALL' mixed mode)
  const getActivePattern = (): SeriesPattern => {
    if (pattern !== 'ALL') return pattern;
    if (availablePatterns.length === 0) {
      return BUILTIN_EXAM_PATTERNS[Math.floor(Math.random() * BUILTIN_EXAM_PATTERNS.length)];
    }
    return availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
  };

  // Generate question
  const loadNextQuestion = (overrideMode?: 'missing' | 'wrong' | 'mixed') => {
    const activePat = getActivePattern();
    const modeToUse = overrideMode || seriesTypeFilter;
    const forcedType: 'missing' | 'wrong' | undefined =
      modeToUse === 'mixed'
        ? Math.random() < 0.5
          ? 'missing'
          : 'wrong'
        : modeToUse;

    const newQ = generateSeriesQuestion(activePat, level, forcedType);
    setCurrentQuestion(newQ);
    setSelectedAnswer(null);
    setTypedAnswer('');
    setShowHint(false);
    setIsAnswered(false);
    setIsCorrect(false);
    qStartTimeRef.current = Date.now();

    if (newQ.type === 'missing') {
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  };

  useEffect(() => {
    loadNextQuestion();
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [level]);

  const submitAnswer = (chosen: number) => {
    if (isAnswered || !currentQuestion) return;

    const timeSpent = Date.now() - qStartTimeRef.current;
    const correct = Math.abs(chosen - currentQuestion.correctAnswer) < 0.001;

    setSelectedAnswer(chosen);
    setIsAnswered(true);
    setIsCorrect(correct);

    const attempt: QuestionAttempt = {
      question: currentQuestion,
      userAnswer: chosen,
      isCorrect: correct,
      timeSpentMs: timeSpent,
    };

    setHistory((prev) => [...prev, attempt]);
  };

  const handleTypedInputChange = (val: string) => {
    if (isAnswered || !currentQuestion) return;
    setTypedAnswer(val);

    if (val.trim() !== '' && val !== '-' && !val.endsWith('.')) {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && Math.abs(parsed - currentQuestion.correctAnswer) < 0.001) {
        submitAnswer(parsed);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && typedAnswer.trim() !== '' && !isAnswered) {
      const parsed = parseFloat(typedAnswer);
      if (!isNaN(parsed)) {
        submitAnswer(parsed);
      }
    }
  };

  const handleNextOrFinish = () => {
    if (currentIdx + 1 >= TOTAL_QUESTIONS) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setIsFinished(true);
    } else {
      setCurrentIdx((prev) => prev + 1);
      loadNextQuestion();
    }
  };

  const handleRestart = (newMode?: 'missing' | 'wrong' | 'mixed') => {
    setCurrentIdx(0);
    setHistory([]);
    setIsFinished(false);
    setElapsedSeconds(0);
    loadNextQuestion(newMode);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  // Summary Metrics
  const summary = useMemo(() => {
    if (history.length === 0) return { accuracy: 0, correctCount: 0, avgTime: '0.0s', totalTime: '0s' };
    const correctCount = history.filter((h) => h.isCorrect).length;
    const accuracy = Math.round((correctCount / history.length) * 100);
    const avgTimeMs = history.reduce((acc, h) => acc + h.timeSpentMs, 0) / history.length;
    return {
      accuracy,
      correctCount,
      avgTime: `${(avgTimeMs / 1000).toFixed(1)}s`,
      totalTime: `${elapsedSeconds}s`,
    };
  }, [history, elapsedSeconds]);

  const levelColor =
    level === 1
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
      : level === 2
      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
      : 'bg-purple-500/15 text-purple-600 dark:text-purple-400';

  if (!currentQuestion) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded-md shrink-0 ${levelColor}`}>
              Level {level}
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              {pattern === 'ALL' ? 'Mixed Drill (All Saved Patterns)' : pattern.title}
            </h3>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Mode Switcher: Missing / Wrong / Mixed */}
            <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              {(
                [
                  { key: 'missing', label: 'Missing (?)' },
                  { key: 'wrong', label: 'Wrong' },
                  { key: 'mixed', label: 'Mixed' },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setSeriesTypeFilter(m.key);
                    handleRestart(m.key);
                  }}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                    seriesTypeFilter === m.key
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Timer */}
            <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <Timer className="w-3.5 h-3.5 text-indigo-500" />
              <span>{elapsedSeconds}s</span>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Close Arena"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!isFinished ? (
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col justify-between">
            <div>
              {/* Progress Bar & Counter */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Progress</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Question {currentIdx + 1} of {TOTAL_QUESTIONS}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-5">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                  style={{ width: `${((currentIdx + 1) / TOTAL_QUESTIONS) * 100}%` }}
                />
              </div>

              {/* Mode Instructions & Optional Hint Button */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span>
                    {currentQuestion.type === 'missing'
                      ? 'Find the Missing Number (?)'
                      : 'Spot and Tap the Wrong Number'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {currentQuestion.type === 'missing' ? 'Keyboard / Numpad' : 'Tap Term Option'}
                  </span>
                </div>

                {!isAnswered && (
                  <button
                    type="button"
                    onClick={() => setShowHint((prev) => !prev)}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                  >
                    {showHint ? 'Hide Hint' : 'Show Hint'}
                  </button>
                )}
              </div>

              {showHint && !isAnswered && (
                <div className="mb-3 px-3.5 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 animate-in fade-in duration-150">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Hint: </span>
                  <span>{currentQuestion.hintText || currentQuestion.patternTitle}</span>
                  {currentQuestion.steps.length > 0 && (
                    <span className="ml-1.5 font-mono text-slate-500 dark:text-slate-400">
                      (First step: {currentQuestion.steps[0]})
                    </span>
                  )}
                </div>
              )}

              {/* Question Presentation: Large Series Numbers */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap py-5 px-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 mb-5">
                {currentQuestion.numbers.map((num, idx) => {
                  const isMissingPlaceholder = num === '?';
                  const isWrongSeries = currentQuestion.type === 'wrong';

                  let tileStyle =
                    'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-xs';

                  if (isMissingPlaceholder) {
                    tileStyle = isAnswered
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105'
                      : 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 border-dashed';
                  } else if (isWrongSeries && isAnswered) {
                    if (num === currentQuestion.correctAnswer) {
                      tileStyle =
                        'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 scale-105';
                    } else if (num === selectedAnswer) {
                      tileStyle =
                        'bg-red-500/15 border-red-500 text-red-600 dark:text-red-400';
                    }
                  } else if (isWrongSeries && !isAnswered) {
                    tileStyle +=
                      ' hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 cursor-pointer';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isAnswered || !isWrongSeries}
                      onClick={() =>
                        isWrongSeries && typeof num === 'number' && submitAnswer(num)
                      }
                      className={`min-w-[48px] sm:min-w-[64px] px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-base sm:text-xl font-bold font-mono tabular-nums border transition-all ${tileStyle}`}
                    >
                      {isMissingPlaceholder && isAnswered
                        ? currentQuestion.correctAnswer
                        : num}
                    </button>
                  );
                })}
              </div>

              {/* Keyboard + Virtual Numpad Input for Missing Number Series */}
              {currentQuestion.type === 'missing' && !isAnswered && (
                <div className="flex flex-col items-center gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      value={typedAnswer}
                      onChange={(e) => handleTypedInputChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="?"
                      className="w-36 sm:w-44 text-center text-2xl sm:text-3xl px-3 py-2.5 font-mono tabular-nums font-bold bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={!typedAnswer.trim()}
                      onClick={() => {
                        const parsed = parseFloat(typedAnswer);
                        if (!isNaN(parsed)) submitAnswer(parsed);
                      }}
                      className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors"
                    >
                      Check
                    </button>
                  </div>

                  <VirtualNumpad
                    handleNumpadPress={(key) => handleTypedInputChange(typedAnswer + key)}
                    deleteLastDigit={() => handleTypedInputChange(typedAnswer.slice(0, -1))}
                  />
                </div>
              )}

              {/* Instant Feedback Banner & Revealed Steps */}
              {isAnswered && (
                <div
                  className={`mt-4 p-4 rounded-2xl border transition-all animate-in fade-in slide-in-from-bottom-2 ${
                    isCorrect
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                    {isCorrect ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          Correct!{' '}
                          {currentQuestion.type === 'wrong' &&
                            currentQuestion.wrongReplacement !== undefined &&
                            `(${currentQuestion.correctAnswer} should be ${currentQuestion.wrongReplacement})`}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span>
                          Incorrect.{' '}
                          {currentQuestion.type === 'wrong' &&
                          currentQuestion.wrongReplacement !== undefined
                            ? `Wrong number was ${currentQuestion.correctAnswer} (should be ${currentQuestion.wrongReplacement})`
                            : `Correct answer was ${currentQuestion.correctAnswer}`}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Step Progression Chain */}
                  <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 opacity-80">
                      Underlying Pattern ({currentQuestion.patternTitle}):
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                      {currentQuestion.steps.map((st, idx) => (
                        <React.Fragment key={idx}>
                          <span className="px-2 py-0.5 text-xs font-mono tabular-nums font-bold rounded bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 whitespace-nowrap">
                            {st}
                          </span>
                          {idx < currentQuestion.steps.length - 1 && (
                            <ArrowRight className="w-3 h-3 opacity-50 shrink-0" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Next Question / Finish Action Button */}
            {isAnswered && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleNextOrFinish}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md transition-colors"
                >
                  <span>
                    {currentIdx + 1 >= TOTAL_QUESTIONS ? 'Finish Session' : 'Next Question'}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Session Summary View */
          <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
              <Award className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
              Drill Completed!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Level {level} Pattern Recognition Summary
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-6">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Accuracy
                </div>
                <div
                  className={`text-xl font-bold tabular-nums ${
                    summary.accuracy >= 80
                      ? 'text-emerald-500'
                      : 'text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {summary.accuracy}%
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Score
                </div>
                <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {summary.correctCount} / {TOTAL_QUESTIONS}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Avg Time
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                  {summary.avgTime}
                </div>
              </div>
            </div>

            {/* Mistakes Breakdown if any */}
            {history.some((h) => !h.isCorrect) && (
              <div className="w-full max-w-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-6 text-left max-h-52 overflow-y-auto">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5">
                  Mistakes Review
                </div>
                <div className="flex flex-col gap-2.5">
                  {history
                    .filter((h) => !h.isCorrect)
                    .map((h, i) => (
                      <div
                        key={i}
                        className="text-xs border-b border-slate-200/70 dark:border-slate-700/60 pb-2 last:border-0 last:pb-0"
                      >
                        <div className="font-mono tabular-nums font-bold text-slate-800 dark:text-slate-100">
                          {h.question.numbers.join('   ')}{' '}
                          <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                            (Ans: {h.question.correctAnswer})
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                          {h.question.steps.join(' → ')}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
              <button
                onClick={() => handleRestart()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-xs"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Drill Again</span>
              </button>

              {onSwitchLevel && (
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  {([1, 2, 3] as SeriesPracticeLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => {
                        onSwitchLevel(lvl);
                        handleRestart();
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        level === lvl
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      L{lvl}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs sm:text-sm rounded-xl transition-colors"
              >
                Back to Vault
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
