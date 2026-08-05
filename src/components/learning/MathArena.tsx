import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  useSpeedMathStore,
  BaseSettings,
  OperationSettings,
} from "../../store/speedMathStore";
import { generateQuestion, Question, Operation } from "../../utils/mathEngine";
import {
  Trophy,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Keyboard,
  AlignCenter,
  AlignLeft,
  AlignRight,
} from "lucide-react";
import { MathArenaSummary } from "./MathArenaSummary";
import { MathRenderer } from "./MathRenderer";
import { VirtualNumpad } from "./VirtualNumpad";

export type TargetMode = "TIME" | "QUESTIONS";
export interface SessionQuota {
  targetType: TargetMode;
  targetValue: number;
  currentValue: number;
  timeSpent: number;
  questionsAttempted: number;
}

export interface MathArenaConfig {
  operations: Operation[];
  baseSettings: BaseSettings;
  overrides?: Partial<Record<Operation, OperationSettings>>;
  digitRange?: [number, number]; // legacy
  timeLimit?: number; // legacy
  name: string;
}

interface MathArenaProps {
  config: MathArenaConfig;
  onClose: () => void;
}

export function MathArena({ config, onClose }: MathArenaProps) {
  const {
    saveGameResult,
    useVirtualKeyboard,
    toggleVirtualKeyboard,
    numpadAlignment,
    cycleNumpadAlignment,
  } = useSpeedMathStore();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [question, setQuestion] = useState<Question | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [multiInputs, setMultiInputs] = useState<[string, string]>(["", ""]);
  const [activeMultiInput, setActiveMultiInput] = useState<0 | 1>(0);
  const [prefilledIndex, setPrefilledIndex] = useState<0 | 1 | null>(null);

  const inputValRef = useRef("");
  const multiInputsRef = useRef<[string, string]>(["", ""]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // Check initially
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const effectiveVirtualKeyboard = isMobile ? true : useVirtualKeyboard;
  const effectiveAlignment = isMobile ? "center" : numpadAlignment;

  // Disable body scroll when full screen
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const [sessionQuotas, setSessionQuotas] = useState<
    Record<Operation, SessionQuota>
  >(() => {
    const initialQuotas: Record<string, SessionQuota> = {};
    if (
      !config.baseSettings.configMode ||
      config.baseSettings.configMode === "GLOBAL"
    ) {
      const mode = config.baseSettings.mode || "TIME";
      const rawDur = Number(config.baseSettings.duration);
      const dur = isNaN(rawDur) || rawDur <= 0 ? 60 : rawDur;
      const target =
        mode === "TIME"
          ? dur * (config.baseSettings.timeUnit === "MIN" ? 60 : 1)
          : Number(config.baseSettings.questionCount) || 20;
      const targetPerOp = Math.max(
        1,
        Math.floor(target / Math.max(1, config.operations.length)),
      );

      config.operations.forEach((op) => {
        initialQuotas[op] = {
          targetType: mode as TargetMode,
          targetValue: targetPerOp,
          currentValue: 0,
          timeSpent: 0,
          questionsAttempted: 0,
        };
      });
    } else {
      config.operations.forEach((op) => {
        const opSettings = config.overrides?.[op];
        const mode = opSettings?.mode || "TIME";
        const rawDur = Number(opSettings?.duration);
        const dur = isNaN(rawDur) || rawDur <= 0 ? 60 : rawDur;
        const target =
          mode === "TIME" ? dur : Number(opSettings?.questionCount) || 20;
        initialQuotas[op] = {
          targetType: mode as TargetMode,
          targetValue: target,
          currentValue: 0,
          timeSpent: 0,
          questionsAttempted: 0,
        };
      });
    }
    return initialQuotas as Record<Operation, SessionQuota>;
  });

  const [timeElapsed, setTimeElapsed] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(
    Date.now(),
  );

  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [mistakes, setMistakes] = useState<
    { q: string; userAns: string; actual: number | string }[]
  >([]);
  const [status, setStatus] = useState<"playing" | "ended">("playing");
  const [flash, setFlash] = useState<"none" | "success" | "error">("none");

  const inputRef = useRef<HTMLInputElement>(null);
  const box1Ref = useRef<HTMLInputElement>(null);
  const box2Ref = useRef<HTMLInputElement>(null);

  const getEligiblePool = (quotas: Record<Operation, SessionQuota>) => {
    return config.operations.filter((op) => {
      const q = quotas[op];
      if (!q) return false;
      return q.currentValue < q.targetValue;
    });
  };

  const handleNextQuestion = (
    currentQuotas: Record<Operation, SessionQuota>,
  ) => {
    const pool = getEligiblePool(currentQuotas);

    if (pool.length === 0) {
      endGame();
      return;
    }

    let nextOp: Operation;
    if (config.baseSettings.shuffle) {
      nextOp = pool[Math.floor(Math.random() * pool.length)];
    } else {
      nextOp = pool[0];
    }

    const opSettings = config.overrides?.[nextOp];
    let newQuestion = generateQuestion(nextOp, opSettings, config.digitRange);

    // Prevent exactly identical questions from appearing consecutively
    let attempts = 0;
    // We only access `question` from state, so it refers to the currently displayed question
    while (
      question &&
      newQuestion.displayString === question.displayString &&
      attempts < 5
    ) {
      newQuestion = generateQuestion(nextOp, opSettings, config.digitRange);
      attempts++;
    }

    setQuestion(newQuestion);
    setQuestionStartTime(Date.now());
    setInputVal("");
    inputValRef.current = "";
    let randIdx: 0 | 1 | null = null;
    if (newQuestion.multiAnswer) {
      randIdx = Math.random() < 0.5 ? 0 : 1;
      setPrefilledIndex(randIdx);
      const initialVals: [string, string] = ["", ""];
      initialVals[randIdx] = newQuestion.multiAnswer[randIdx].toString();
      setMultiInputs(initialVals);
      multiInputsRef.current = initialVals;
      setActiveMultiInput(randIdx === 0 ? 1 : 0);
    } else {
      setPrefilledIndex(null);
      setMultiInputs(["", ""]);
      multiInputsRef.current = ["", ""];
      setActiveMultiInput(0);
    }

    setTimeout(() => {
      if (newQuestion.multiAnswer) {
        if (randIdx === 0) box2Ref.current?.focus();
        else box1Ref.current?.focus();
      } else {
        inputRef.current?.focus();
      }
    }, 10);
  };

  useEffect(() => {
    handleNextQuestion(sessionQuotas);
  }, []);

  useEffect(() => {
    if (status === "playing") {
      const timerId = setInterval(() => {
        setTimeElapsed((t) => t + 1);

        if (question) {
          const qState = sessionQuotas[question.operation];
          if (qState && qState.targetType === "TIME") {
            const elapsedNow = (Date.now() - questionStartTime) / 1000;
            if (qState.currentValue + elapsedNow >= qState.targetValue) {
              setTimeout(() => processAnswer("time_up", true, false), 0);
            }
          }
        }
      }, 1000);
      return () => clearInterval(timerId);
    }
  }, [status, question, questionStartTime, sessionQuotas]);

  const endGame = () => {
    setStatus("ended");
    saveGameResult({
      score,
      total,
      presetName: config.name,
    });
  };

  const processAnswer = (
    userAns: string,
    isPassed: boolean,
    isCorrect: boolean,
  ) => {
    if (!question) return;

    if (!isPassed) {
      if (isCorrect) {
        setScore((s) => s + 1);
        handleFlash("success");
      } else {
        setMistakes((m) => [
          ...m,
          {
            q: question.displayString,
            userAns,
            actual: question.correctAnswer,
          },
        ]);
        handleFlash("error");
      }
    } else {
      setMistakes((m) => [
        ...m,
        {
          q: question.displayString,
          userAns: "passed",
          actual: question.correctAnswer,
        },
      ]);
    }

    setTotal((t) => t + 1);

    const qState = sessionQuotas[question.operation];
    if (!qState) return;

    const newQuotas = { ...sessionQuotas };
    const currentOp = { ...qState };

    const elapsedSecs = (Date.now() - questionStartTime) / 1000;
    if (currentOp.targetType === "TIME") {
      currentOp.currentValue += elapsedSecs;
      currentOp.timeSpent += elapsedSecs;
    } else {
      currentOp.currentValue += 1;
      currentOp.timeSpent += elapsedSecs;
    }
    currentOp.questionsAttempted += 1;

    newQuotas[question.operation] = currentOp;
    setSessionQuotas(newQuotas);
    setTimeout(() => handleNextQuestion(newQuotas), 0);
  };

  const handleFlash = (type: "success" | "error") => {
    setFlash(type);
    setTimeout(() => setFlash("none"), 300);
  };

  const handleMultiInputChange = (index: 0 | 1, val: string) => {
    const newVals: [string, string] = [...multiInputsRef.current] as [
      string,
      string,
    ];
    newVals[index] = val;
    multiInputsRef.current = newVals;
    setMultiInputs(newVals);

    if (question && question.multiAnswer) {
      // Check validation
      const parsed1 = parseFloat(newVals[0]);
      const parsed2 = parseFloat(newVals[1]);

      if (!isNaN(parsed1) && !isNaN(parsed2)) {
        if (
          parsed1 === question.multiAnswer[0] &&
          parsed2 === question.multiAnswer[1]
        ) {
          processAnswer(`${parsed1}, ${parsed2}`, false, true);
        } else if (
          newVals[0].trim().length >=
            question.multiAnswer[0].toString().length &&
          newVals[1].trim().length >= question.multiAnswer[1].toString().length
        ) {
          handleFlash("error");
          setMistakes((m) => [
            ...m,
            {
              q: question.displayString,
              userAns: `${newVals[0]}, ${newVals[1]}`,
              actual: question.multiAnswer!.join(", "),
            },
          ]);
          const resetVals: [string, string] = ["", ""];
          if (prefilledIndex !== null && question.multiAnswer) {
            resetVals[prefilledIndex] =
              question.multiAnswer[prefilledIndex].toString();
          }
          multiInputsRef.current = resetVals;
          setMultiInputs(resetVals);
          if (prefilledIndex === 0) box2Ref.current?.focus();
          else box1Ref.current?.focus();
        }
      }
    }
  };

  const handleMultiKeyDown = (
    index: 0 | 1,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (effectiveVirtualKeyboard) {
      if (e.key === "Backspace") {
        handleMultiInputChange(
          index,
          multiInputsRef.current[index].slice(0, -1),
        );
        return;
      }
      if (/^[0-9.-]$/.test(e.key)) {
        handleMultiInputChange(index, multiInputsRef.current[index] + e.key);
        return;
      }
    } else {
      const currentInputs = multiInputsRef.current;
      if (
        e.key === "Enter" &&
        currentInputs[0] !== "" &&
        currentInputs[1] !== ""
      ) {
        e.preventDefault();
        const parsed1 = parseFloat(currentInputs[0]);
        const parsed2 = parseFloat(currentInputs[1]);
        if (question && question.multiAnswer) {
          if (
            parsed1 === question.multiAnswer[0] &&
            parsed2 === question.multiAnswer[1]
          ) {
            processAnswer(`${parsed1}, ${parsed2}`, false, true);
          } else {
            handleFlash("error");
            setMistakes((m) => [
              ...m,
              {
                q: question.displayString,
                userAns: `${currentInputs[0]}, ${currentInputs[1]}`,
                actual: question.multiAnswer!.join(", "),
              },
            ]);
            const resetVals: [string, string] = ["", ""];
            if (prefilledIndex !== null && question.multiAnswer) {
              resetVals[prefilledIndex] =
                question.multiAnswer[prefilledIndex].toString();
            }
            multiInputsRef.current = resetVals;
            setMultiInputs(resetVals);
            if (prefilledIndex === 0) box2Ref.current?.focus();
            else box1Ref.current?.focus();
          }
        }
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    inputValRef.current = val;
    setInputVal(val);

    if (question && val.trim() !== "") {
      const parsedVal = parseFloat(val);
      if (
        parsedVal === question.correctAnswer ||
        (question.operation === "frac" &&
          Math.abs(parsedVal - question.correctAnswer) < 0.05)
      ) {
        processAnswer(val, false, true);
      } else if (
        val.trim().length >= question.correctAnswer.toString().length
      ) {
        handleFlash("error");
        setMistakes((m) => [
          ...m,
          {
            q: question.displayString,
            userAns: val,
            actual: question.correctAnswer,
          },
        ]);
        inputValRef.current = "";
        setInputVal("");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (effectiveVirtualKeyboard) {
      if (e.key === "Backspace") {
        const dummyEvent = {
          target: { value: inputValRef.current.slice(0, -1) },
        };
        handleInputChange(
          dummyEvent as unknown as React.ChangeEvent<HTMLInputElement>,
        );
        return;
      }
      if (/^[0-9.-]$/.test(e.key)) {
        const dummyEvent = { target: { value: inputValRef.current + e.key } };
        handleInputChange(
          dummyEvent as unknown as React.ChangeEvent<HTMLInputElement>,
        );
        return;
      }
    }

    if (e.key === "Enter" && inputValRef.current.trim() !== "" && question) {
      const parsedVal = parseFloat(inputValRef.current);
      if (
        parsedVal !== question.correctAnswer &&
        !(
          question.operation === "frac" &&
          Math.abs(parsedVal - question.correctAnswer) < 0.05
        )
      ) {
        handleFlash("error");
        setMistakes((m) => [
          ...m,
          {
            q: question.displayString,
            userAns: inputValRef.current,
            actual: question.correctAnswer,
          },
        ]);
        inputValRef.current = "";
        setInputVal("");
      } else {
        processAnswer(inputValRef.current, false, true);
      }
    }
  };

  const passQuestion = () => {
    if (question) {
      processAnswer("passed", true, false);
    }
  };

  if (status === "ended") {
    return (
      <MathArenaSummary
        score={score}
        total={total}
        timeElapsed={timeElapsed}
        config={config}
        sessionQuotas={sessionQuotas}
        mistakes={mistakes}
        onClose={onClose}
        onPlayAgain={() => {
          setScore(0);
          setTotal(0);
          setMistakes([]);
          setTimeElapsed(0);
          setStatus("playing");

          const refreshed = { ...sessionQuotas };
          Object.keys(refreshed).forEach((k) => {
            refreshed[k as Operation] = {
              ...refreshed[k as Operation],
              currentValue: 0,
              timeSpent: 0,
              questionsAttempted: 0,
            };
          });
          setSessionQuotas(refreshed);
          setTimeout(() => handleNextQuestion(refreshed), 0);
        }}
      />
    );
  }

  return createPortal(
    <div
      data-jarvis-section="speed-math"
      data-jarvis-question-id={question?.id || 'math_active'}
      data-jarvis-subject="Mathematics"
      data-jarvis-topic={config.name || "Speed Math"}
      data-jarvis-status={status}
      className={`fixed inset-0 z-[9999] bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm overflow-y-auto flex items-center p-4 md:p-8 ${numpadAlignment === "center" ? "justify-center" : numpadAlignment === "left" ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`flex flex-col justify-center min-h-[500px] w-full max-w-2xl p-8 rounded-2xl border shadow-xl transition-all duration-300 ${numpadAlignment === "center" ? "items-center" : numpadAlignment === "left" ? "items-start" : "items-end"} ${
          flash === "success"
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-500/30"
            : flash === "error"
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30"
              : "bg-white dark:bg-[#1E1F25] border-slate-200 dark:border-slate-800"
        }`}
      >
        <div className="w-full flex justify-between items-center mb-6 md:mb-12">
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={onClose}
              className="p-1.5 md:p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={toggleVirtualKeyboard}
              className={`hidden md:block p-1.5 md:p-2 rounded-lg transition-colors ${effectiveVirtualKeyboard ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"}`}
              title={
                effectiveVirtualKeyboard
                  ? "Disable Virtual Keyboard"
                  : "Enable Virtual Keyboard"
              }
            >
              <Keyboard className="w-5 h-5" />
            </button>
            <button
              onClick={cycleNumpadAlignment}
              className="hidden md:block p-1.5 md:p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Change Alignment"
            >
              {effectiveAlignment === "center" ? (
                <AlignCenter className="w-5 h-5" />
              ) : effectiveAlignment === "left" ? (
                <AlignLeft className="w-5 h-5" />
              ) : (
                <AlignRight className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="font-mono text-xs md:text-lg font-medium text-slate-600 dark:text-slate-400">
              Score:{" "}
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                {score}
              </span>
              /{total}
            </div>

            {(() => {
              const isMixedTargets = Object.values(sessionQuotas).some(
                (q, i, arr) => q.targetType !== arr[0]?.targetType,
              );
              const showGlobalStyle =
                config.baseSettings.shuffle || isMixedTargets;

              if (showGlobalStyle) {
                return (
                  <div className="flex gap-1 md:gap-2">
                    <div className="font-mono text-xs md:text-lg font-bold px-2 md:px-4 py-1 md:py-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Q: {total + 1}
                    </div>
                    <div className="font-mono text-xs md:text-lg font-bold px-2 md:px-4 py-1 md:py-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      ⏱ {Math.floor(timeElapsed / 60)}:
                      {(timeElapsed % 60).toString().padStart(2, "0")}
                    </div>
                  </div>
                );
              }

              if (question) {
                const qState = sessionQuotas[question.operation];
                if (qState.targetType === "TIME") {
                  const elapsedNow = (Date.now() - questionStartTime) / 1000;
                  const timeLeft = Math.max(
                    0,
                    Math.ceil(
                      qState.targetValue - (qState.currentValue + elapsedNow),
                    ),
                  );
                  return (
                    <div
                      className={`font-mono text-sm md:text-xl font-bold px-2 md:px-4 py-1 md:py-1.5 rounded-lg transition-colors ${timeLeft <= 10 ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
                    >
                      {Math.floor(timeLeft / 60)}:
                      {(timeLeft % 60).toString().padStart(2, "0")} left
                    </div>
                  );
                } else {
                  return (
                    <div className="flex gap-1 md:gap-2">
                      <div className="font-mono text-xs md:text-lg font-bold px-2 md:px-4 py-1 md:py-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 capitalize">
                        {question.operation}:{" "}
                        <span className="hidden sm:inline">
                          {Math.min(
                            qState.targetValue,
                            Math.floor(qState.currentValue) + 1,
                          )}{" "}
                          / {qState.targetValue}
                        </span>
                        <span className="sm:hidden">
                          {Math.min(
                            qState.targetValue,
                            Math.floor(qState.currentValue) + 1,
                          )}
                        </span>
                      </div>
                      <div className="font-mono text-xs md:text-lg font-bold px-2 md:px-4 py-1 md:py-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        ⏱ {Math.floor(timeElapsed / 60)}:
                        {(timeElapsed % 60).toString().padStart(2, "0")}
                      </div>
                    </div>
                  );
                }
              }
              return null;
            })()}
          </div>
        </div>

        {question && (
          <div
            className={`flex flex-col ${effectiveAlignment === "center" ? "items-center" : effectiveAlignment === "left" ? "items-start" : "items-end"} w-full animate-in fade-in slide-in-from-bottom-2`}
          >
            <div
              className={`font-bold font-mono tracking-tight max-w-full ${effectiveAlignment === "center" ? "text-center flex justify-center" : effectiveAlignment === "left" ? "text-left flex justify-start" : "text-right flex justify-end"} items-center h-[120px] md:h-[150px] shrink-0 text-slate-800 dark:text-slate-100 mb-6 md:mb-8 transition-colors ${
                flash === "success"
                  ? "text-green-600 dark:text-green-400"
                  : flash === "error"
                    ? "text-red-600 dark:text-red-400"
                    : ""
              }`}
              style={{
                fontSize: `clamp(1rem, min(8vw, calc(3.5rem - ${Math.max(0, question.displayString.length - 12) * 0.08}rem)), 4.5rem)`,
                lineHeight: "1.3",
              }}
            >
              <MathRenderer expr={question.displayString} />
            </div>

            {question.multiAnswer ? (
              <div className="flex items-center gap-4">
                <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                  ref={box1Ref}
                  type="tel"
                  inputMode={effectiveVirtualKeyboard ? "none" : "tel"}
                  readOnly={effectiveVirtualKeyboard || prefilledIndex === 0}
                  onFocus={() => {
                    if (prefilledIndex !== 0) setActiveMultiInput(0);
                  }}
                  value={multiInputs[0]}
                  onChange={(e) => {
                    if (prefilledIndex !== 0)
                      handleMultiInputChange(0, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (prefilledIndex !== 0) handleMultiKeyDown(0, e);
                  }}
                  placeholder="?"
                  className={`w-[120px] text-center text-4xl px-4 py-4 font-mono font-bold border-2 rounded-2xl outline-none shadow-inner transition-colors ${
                    prefilledIndex === 0
                      ? "bg-transparent border-transparent shadow-none text-slate-800 dark:text-slate-100 placeholder-transparent pointer-events-none"
                      : "bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-white"
                  }`}
                />

                <span className="text-4xl font-bold font-mono text-slate-400 dark:text-slate-500">
                  {question.operation === "table" ? "×" : "/"}
                </span>

                <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                  ref={box2Ref}
                  type="tel"
                  inputMode={effectiveVirtualKeyboard ? "none" : "tel"}
                  readOnly={effectiveVirtualKeyboard || prefilledIndex === 1}
                  onFocus={() => {
                    if (prefilledIndex !== 1) setActiveMultiInput(1);
                  }}
                  value={multiInputs[1]}
                  onChange={(e) => {
                    if (prefilledIndex !== 1)
                      handleMultiInputChange(1, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (prefilledIndex !== 1) handleMultiKeyDown(1, e);
                  }}
                  placeholder="?"
                  className={`w-[120px] text-center text-4xl px-4 py-4 font-mono font-bold border-2 rounded-2xl outline-none shadow-inner transition-colors ${
                    prefilledIndex === 1
                      ? "bg-transparent border-transparent shadow-none text-slate-800 dark:text-slate-100 placeholder-transparent pointer-events-none"
                      : "bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-white"
                  }`}
                />
              </div>
            ) : (
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                ref={inputRef}
                type="tel"
                inputMode={effectiveVirtualKeyboard ? "none" : "tel"}
                readOnly={effectiveVirtualKeyboard}
                autoFocus
                value={inputVal}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="?"
                className="w-full max-w-[200px] text-center text-4xl px-4 py-4 font-mono font-bold bg-slate-50 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-white shadow-inner transition-colors"
                autoCorrect="off" spellCheck={false}     />
            )}

            {effectiveVirtualKeyboard && (
              <VirtualNumpad
                handleNumpadPress={(key) => {
                  if (question?.multiAnswer) {
                    if (prefilledIndex === activeMultiInput) return;
                    handleMultiInputChange(
                      activeMultiInput,
                      multiInputsRef.current[activeMultiInput] + key,
                    );
                  } else {
                    const dummyEvent = {
                      target: { value: inputValRef.current + key },
                    };
                    handleInputChange(
                      dummyEvent as unknown as React.ChangeEvent<HTMLInputElement>,
                    );
                  }
                }}
                deleteLastDigit={() => {
                  if (question?.multiAnswer) {
                    if (prefilledIndex === activeMultiInput) return;
                    handleMultiInputChange(
                      activeMultiInput,
                      multiInputsRef.current[activeMultiInput].slice(0, -1),
                    );
                  } else {
                    const dummyEvent = {
                      target: { value: inputValRef.current.slice(0, -1) },
                    };
                    handleInputChange(
                      dummyEvent as unknown as React.ChangeEvent<HTMLInputElement>,
                    );
                  }
                }}
              />
            )}

            <button
              onClick={passQuestion}
              className="mt-4 text-sm font-medium text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors"
            >
              Pass / Skip Question
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
