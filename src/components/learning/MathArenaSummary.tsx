import React from "react";
import { createPortal } from "react-dom";
import { Trophy, AlertCircle, RefreshCw } from "lucide-react";
import { Operation } from "../../utils/mathEngine";
import { SessionQuota } from "./MathArena";
import { MathRenderer } from "./MathRenderer";

interface MathArenaSummaryProps {
  score: number;
  total: number;
  timeElapsed: number;
  config: any;
  sessionQuotas: Record<string, SessionQuota>;
  mistakes: Array<{
    q: string;
    userAns: string;
    actual: string | number;
    seriesSteps?: string[];
    patternTitle?: string;
    seriesType?: "missing" | "wrong";
    wrongReplacement?: number;
  }>;
  onClose: () => void;
  onPlayAgain: () => void;
}

export function MathArenaSummary({
  score,
  total,
  timeElapsed,
  config,
  sessionQuotas,
  mistakes,
  onClose,
  onPlayAgain,
}: MathArenaSummaryProps) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-4">
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-[#1E1F25] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 w-full max-w-2xl mx-auto shadow-sm animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-yellow-50 dark:bg-yellow-500/10 rounded-full flex items-center justify-center mb-4 md:mb-6">
          <Trophy className="w-8 h-8 md:w-10 md:h-10 text-yellow-500" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mb-2">
          Finished!
        </h2>
        <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 mb-6 md:mb-8 text-center text-balance">
          You scored <span className="font-bold text-indigo-600 dark:text-indigo-400">{score}</span> out of {total}
          {timeElapsed > 0 && ` in ${Math.floor(timeElapsed / 60)}:${(timeElapsed % 60).toString().padStart(2, "0")}`}
        </p>

        <div className="w-full flex flex-wrap justify-center gap-2 md:gap-3 mb-6 md:mb-8">
          {config.operations.map((op: Operation) => {
            const qStat = sessionQuotas[op];
            if (!qStat || qStat.questionsAttempted === 0) return null;

            const m = Math.floor(qStat.timeSpent / 60);
            const s = Math.floor(qStat.timeSpent % 60);
            const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
            const opNames: Record<string, string> = {
              "+": "Addition",
              "-": "Subtraction",
              "*": "Multiplication",
              x: "Multiplication",
              "/": "Division",
              sq: "Squares",
              cube: "Cubes",
              frac: "Fractions",
              table: "Tables",
              mix: "Mix",
              series: "Series",
            };
            const opName = opNames[op] || op;

            return (
              <div
                key={op}
                className="p-2 md:p-3 min-w-[100px] md:min-w-[120px] max-w-[140px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-center"
              >
                <span className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 md:mb-1">
                  {opName}
                </span>
                <span className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight leading-none mb-1">
                  {qStat.questionsAttempted}{" "}
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium -ml-0.5">
                    qs
                  </span>
                </span>
                <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-medium">
                  in {timeStr}
                </span>
              </div>
            );
          })}
        </div>

        {mistakes.length > 0 && (
          <div className="w-full bg-slate-50 dark:bg-slate-900 rounded-xl p-5 mb-8 max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800/50 text-left">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" /> Mistakes Review
            </h3>
            <ul className="flex flex-col gap-3">
              {mistakes.map((m, i) => (
                <li
                  key={i}
                  className="flex flex-col text-xs md:text-sm border-b border-slate-200 dark:border-slate-800/50 pb-3 last:border-0 last:pb-0 gap-1.5"
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-700 dark:text-slate-300 font-mono tabular-nums text-sm md:text-base inline-flex flex-wrap items-center gap-1.5">
                      <MathRenderer expr={m.q} />
                      <span className="font-bold text-green-600 dark:text-green-400 ml-1">
                        {m.seriesType === "wrong" && m.wrongReplacement !== undefined
                          ? `Wrong: ${m.actual} (Should be ${m.wrongReplacement})`
                          : `Ans: ${m.actual}`}
                      </span>
                    </span>
                    <span className="text-red-500 line-through bg-red-50 dark:bg-red-500/10 px-1.5 md:px-2 py-0.5 rounded font-mono shrink-0">
                      {m.userAns}
                    </span>
                  </div>
                  {m.seriesSteps && m.seriesSteps.length > 0 && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 pt-0.5">
                      {m.patternTitle && (
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {m.patternTitle}:
                        </span>
                      )}
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {m.seriesSteps.join("  →  ")}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-row gap-3 md:gap-4 w-full sm:w-auto mt-4 md:mt-0">
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-3 md:px-6 py-2.5 md:py-3 font-medium text-sm md:text-base text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap"
          >
            Back to Hub
          </button>
          <button
            onClick={onPlayAgain}
            className="flex-1 sm:flex-none px-3 md:px-6 py-2.5 md:py-3 font-medium text-sm md:text-base text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center justify-center gap-1.5 md:gap-2 shadow-sm whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> Play Again
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
