import React from "react";
import { Operation } from "../../utils/mathEngine";
import {
  BaseSettings,
  OperationSettings,
  PracticeMode,
  TimeUnit,
  DifficultyLevel,
} from "../../store/speedMathStore";
import { CustomSelect } from "../ui/CustomSelect";

interface Props {
  operation: Operation;
  baseSettings?: BaseSettings;
  opSettings: OperationSettings;
  onChange: (base: BaseSettings | undefined, op: OperationSettings) => void;
  hideBaseSettings?: boolean;
}

const DIFFICULTIES: DifficultyLevel[] = [
  "BEGINNER",
  "EASY",
  "MEDIUM",
  "HARD",
  "CHALLENGING",
  "EXPERT",
];

const getDifficultyDescription = (op: Operation, diff: DifficultyLevel) => {
  if (op === "+") {
    switch (diff) {
      case "BEGINNER":
        return "1 digit + 1 digit";
      case "EASY":
        return "2 digit + 1 digit, or simple 2+2";
      case "MEDIUM":
        return "2 digit + 2 digit moderate";
      case "HARD":
        return "3 digit + 3 digit moderate";
      case "CHALLENGING":
        return "4 digit + 3 digit or 4 digit + 4 digit";
      case "EXPERT":
        return "5 digit + 4 digit or 5 digit + 5 digit";
    }
  }
  if (op === "-") {
    switch (diff) {
      case "BEGINNER":
        return "1 digit - 1 digit";
      case "EASY":
        return "2 digit - 1 digit, simple 2-2";
      case "MEDIUM":
        return "2 digit - 2 digit moderate";
      case "HARD":
        return "3 digit - 3 digit moderate";
      case "CHALLENGING":
        return "4 digit - 3 digit or 4 digit - 4 digit";
      case "EXPERT":
        return "5 digit - 4 digit or 5 digit - 5 digit";
    }
  }
  if (op === "*" || op === "/") {
    switch (diff) {
      case "BEGINNER":
        return "1 digit by 1 digit";
      case "EASY":
        return "2 digit by 1 digit simple";
      case "MEDIUM":
        return "2 digit by 2 digit simple";
      case "HARD":
        return "2 digit by 2 digit moderate";
      case "CHALLENGING":
        return "3 digit by 2 digit moderate";
      case "EXPERT":
        return "4 digit by 2 digit, 3 digit by 3 digit";
    }
  }
  return "";
};

export function OperationConfigurator({
  operation,
  baseSettings,
  opSettings,
  onChange,
  hideBaseSettings = false,
}: Props) {
  const isArithmetic = ["+", "-", "*", "/"].includes(operation);
  const isMix = operation === "mix";

  const updateBase = (updates: Partial<BaseSettings>) => {
    if (baseSettings) onChange({ ...baseSettings, ...updates }, opSettings);
  };

  const updateOp = (updates: Partial<OperationSettings>) => {
    onChange(baseSettings, { ...opSettings, ...updates });
  };

  return (
    <div className="flex flex-col gap-4">
      {!hideBaseSettings && baseSettings && (
        <div className="space-y-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
            Practice Mode
          </label>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              type="button"
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${baseSettings.mode === "TIME" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50"}`}
              onClick={() => updateBase({ mode: "TIME" })}
            >
              Time Limit
            </button>
            <button
              type="button"
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${baseSettings.mode === "QUESTIONS" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50"}`}
              onClick={() => updateBase({ mode: "QUESTIONS" })}
            >
              Target Questions
            </button>
          </div>

          {baseSettings.mode === "TIME" ? (
            <div className="flex gap-2 mt-3 w-full">
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="number"
                className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-sm"
                value={baseSettings.duration ?? 60}
                onChange={(e) =>
                  updateBase({
                    duration:
                      e.target.value === ""
                        ? ("" as any)
                        : parseInt(e.target.value) || 0,
                  })
                }
              />
              <CustomSelect
                className="w-20 shrink-0"
                value={baseSettings.timeUnit || "SEC"}
                onChange={(value) =>
                  updateBase({ timeUnit: value as TimeUnit })
                }
                options={[
                  { value: "MIN", label: "Min" },
                  { value: "SEC", label: "Sec" },
                ]}
              />
            </div>
          ) : (
            <div className="mt-3">
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="number"
                placeholder="No. of questions"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-sm"
                value={baseSettings.questionCount ?? 20}
                onChange={(e) =>
                  updateBase({
                    questionCount:
                      e.target.value === ""
                        ? ("" as any)
                        : parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          )}
        </div>
      )}

      {baseSettings?.configMode === "INDIVIDUAL" && (
        <div className="space-y-3 pb-3 mb-1 border-b border-slate-100 dark:border-slate-800">
          <label className="text-[13px] font-medium text-slate-700 dark:text-slate-300 block mb-1">
            Section Limits
          </label>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              type="button"
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${!opSettings.mode || opSettings.mode === "TIME" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50"}`}
              onClick={() => updateOp({ mode: "TIME" })}
            >
              Time Limit
            </button>
            <button
              type="button"
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${opSettings.mode === "QUESTIONS" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50"}`}
              onClick={() => updateOp({ mode: "QUESTIONS" })}
            >
              Target Questions
            </button>
          </div>

          {!opSettings.mode || opSettings.mode === "TIME" ? (
            <div className="flex gap-2 w-full">
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="number"
                className="flex-1 min-w-0 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:border-indigo-500 text-xs"
                placeholder="Time (sec)"
                value={opSettings.duration ?? ""}
                onChange={(e) =>
                  updateOp({
                    duration:
                      e.target.value === ""
                        ? undefined
                        : parseInt(e.target.value) || 0,
                  })
                }
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 my-auto">
                Sec
              </span>
            </div>
          ) : (
            <div className="w-full">
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="number"
                placeholder="No. of questions"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:border-indigo-500 text-xs"
                value={opSettings.questionCount ?? ""}
                onChange={(e) =>
                  updateOp({
                    questionCount:
                      e.target.value === ""
                        ? undefined
                        : parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          )}
        </div>
      )}

      <div>
        {operation === "series" ? (
          <div className="flex flex-col gap-3.5">
            {/* 1. Series Type: Missing / Wrong / Mixed */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                Series Mode
              </label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {(
                  [
                    { value: "MISSING", label: "Missing (?)" },
                    { value: "WRONG", label: "Wrong Term" },
                    { value: "MIXED", label: "Mixed" },
                  ] as const
                ).map((item) => {
                  const activeMode =
                    opSettings.seriesMode ||
                    (opSettings.isReverse ? "WRONG" : "MISSING");
                  const isActive = activeMode === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() =>
                        updateOp({
                          seriesMode: item.value,
                          isReverse: item.value === "WRONG",
                        })
                      }
                      className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors whitespace-nowrap ${
                        isActive
                          ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {(opSettings.seriesMode || (opSettings.isReverse ? "WRONG" : "MISSING")) === "MISSING"
                  ? "Type missing number via Keyboard / Numpad"
                  : (opSettings.seriesMode || (opSettings.isReverse ? "WRONG" : "MISSING")) === "WRONG"
                  ? "Tap the wrong number from series options"
                  : "Alternates Missing (Numpad) & Wrong (Options)"}
              </p>
            </div>

            {/* 2. Pattern Source: Saved Vault vs Built-in Exam Pack */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                Pattern Source
              </label>
              <CustomSelect
                className="w-full"
                value={opSettings.seriesSource || "VAULT"}
                onChange={(value) =>
                  updateOp({ seriesSource: value as any })
                }
                options={[
                  { value: "VAULT", label: "Saved Vault Patterns" },
                  { value: "BUILTIN", label: "Built-in Exam Pack" },
                  { value: "BOTH", label: "All (Saved + Exam Pack)" },
                ]}
              />
            </div>

            {/* 3. Exam Difficulty Level */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                Exam Difficulty
              </label>
              <CustomSelect
                className="w-full mb-1"
                value={
                  ["HARD", "CHALLENGING", "EXPERT"].includes(
                    opSettings.difficulty || "EASY"
                  )
                    ? "HARD"
                    : opSettings.difficulty === "MEDIUM"
                    ? "MEDIUM"
                    : "EASY"
                }
                onChange={(value) =>
                  updateOp({ difficulty: value as DifficultyLevel })
                }
                options={[
                  { value: "EASY", label: "Level 1 · Clerk Prelims (Easy)" },
                  { value: "MEDIUM", label: "Level 2 · PO Prelims (Medium)" },
                  { value: "HARD", label: "Level 3 · PO Mains (Hard)" },
                ]}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {["HARD", "CHALLENGING", "EXPERT"].includes(
                  opSettings.difficulty || "EASY"
                )
                  ? "Alternating (+/-), n²±1 camouflage & early traps"
                  : opSettings.difficulty === "MEDIUM"
                  ? "Gapped steps (1², 3², 5² / alt primes) & mid '?'"
                  : "Consecutive steps, 2–3 digit numbers & end '?'"}
              </p>
            </div>
          </div>
        ) : isArithmetic || isMix ? (
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
              Difficulty
            </label>
            <CustomSelect
              className="mb-1 w-full sm:w-60"
              value={opSettings.difficulty || "EASY"}
              onChange={(value) =>
                updateOp({ difficulty: value as DifficultyLevel })
              }
              options={DIFFICULTIES.map((d) => ({
                value: d,
                label: d.charAt(0) + d.slice(1).toLowerCase(),
              }))}
            />
            {isArithmetic && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {getDifficultyDescription(
                  operation,
                  opSettings.difficulty || "EASY",
                )}
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
              Number Range
            </label>
            <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              type="text"
              placeholder="e.g. 10-20, 25, 30-35"
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-sm"
              value={opSettings.customRanges ?? "1-10"}
              onChange={(e) => updateOp({ customRanges: e.target.value })}
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Format: 1-10, 15, 20-25
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
