import React from "react";
import { createPortal } from "react-dom";
import { Settings, X, ChevronDown, ArrowLeftRight } from "lucide-react";
import { Operation } from "../../utils/mathEngine";
import { OperationConfigurator } from "./OperationConfigurator";
import { basicOperations } from "./SpeedMathHub";

interface SpeedMathPresetModalProps {
  isModalOpen: boolean;
  editingPresetId: string | null;
  newPresetName: string;
  setNewPresetName: (val: string) => void;
  selectedOps: Operation[];
  setTimeLimit: (val: number | string) => void;
  timeLimit: number | string;
  questionCount: number | string;
  setQuestionCount: (val: number | string) => void;
  presetMode: "TIME" | "QUESTIONS";
  setPresetMode: (val: "TIME" | "QUESTIONS") => void;
  presetConfigMode: "GLOBAL" | "INDIVIDUAL";
  setPresetConfigMode: (val: "GLOBAL" | "INDIVIDUAL") => void;
  presetShuffle: boolean;
  setPresetShuffle: (val: boolean) => void;
  presetOverrides: any;
  setPresetOverrides: (val: any) => void;
  expandedOp: Operation | null;
  setExpandedOp: (val: Operation | null) => void;
  handleSavePreset: (e: React.FormEvent) => void;
  toggleOp: (op: Operation) => void;
  handleClose: () => void;
}

export function SpeedMathPresetModal({
  isModalOpen,
  editingPresetId,
  newPresetName,
  setNewPresetName,
  selectedOps,
  timeLimit,
  setTimeLimit,
  questionCount,
  setQuestionCount,
  presetMode,
  setPresetMode,
  presetConfigMode,
  setPresetConfigMode,
  presetShuffle,
  setPresetShuffle,
  presetOverrides,
  setPresetOverrides,
  expandedOp,
  setExpandedOp,
  handleSavePreset,
  toggleOp,
  handleClose,
}: SpeedMathPresetModalProps) {
  if (!isModalOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1E1F25] rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Settings className="w-4 h-4" /> {editingPresetId ? "Edit Custom Preset" : "Create Custom Preset"}
          </h3>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSavePreset}
          className="p-5 flex flex-col gap-4 overflow-y-auto"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Preset Name
            </label>
            <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              type="text"
              required
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="e.g. My Daily Warmup"
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-sm text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Operations
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                ["+", "-", "*", "/", "sq", "cube", "frac", "table"] as Operation[]
              ).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => toggleOp(op)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    selectedOps.includes(op)
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300"
                      : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                  }`}
                >
                  {op === "sq"
                    ? "Squares"
                    : op === "cube"
                      ? "Cubes"
                      : op === "frac"
                        ? "Fractions"
                        : op === "table"
                          ? "Multiplication Table"
                          : op}
                </button>
              ))}
            </div>
            {selectedOps.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                Select at least one operation.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-[13px] font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Configuration Mode
            </label>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                type="button"
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${presetConfigMode === "GLOBAL" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50"}`}
                onClick={() => {
                    setPresetConfigMode("GLOBAL");
                }}
              >
                Global Limit
              </button>
              <button
                type="button"
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${presetConfigMode === "INDIVIDUAL" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50"}`}
                onClick={() => {
                    // Pre-fill
                    if (presetConfigMode === "GLOBAL" && selectedOps.length > 0) {
                        const numOps = selectedOps.length || 1;
                        setPresetOverrides((prev: any) => {
                            const newOverrides = { ...prev };
                            selectedOps.forEach(op => {
                                if (!newOverrides[op]) newOverrides[op] = {};
                                newOverrides[op].mode = presetMode;
                                if (presetMode === "TIME") {
                                    newOverrides[op].duration = Math.max(5, Math.floor((Number(timeLimit) || 60) / numOps));
                                } else {
                                    newOverrides[op].questionCount = Math.max(1, Math.floor((Number(questionCount) || 20) / numOps));
                                }
                            });
                            return newOverrides;
                        });
                    }
                    setPresetConfigMode("INDIVIDUAL");
                }}
              >
                Individual Section Limits
              </button>
            </div>
          </div>

          {presetConfigMode === "GLOBAL" && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
                Global Practice Target
              </label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${presetMode === "TIME" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50"}`}
                  onClick={() => setPresetMode("TIME")}
                >
                  Time Limit
                </button>
                <button
                  type="button"
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${presetMode === "QUESTIONS" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50"}`}
                  onClick={() => setPresetMode("QUESTIONS")}
                >
                  Target Questions
                </button>
              </div>

              {presetMode === "TIME" ? (
                <div className="flex gap-2">
                  <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                    type="number"
                    className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-sm"
                    value={timeLimit}
                    onChange={(e) =>
                      setTimeLimit(
                        e.target.value === ""
                          ? ""
                          : parseInt(e.target.value) || 0,
                      )
                    }
                  />
                  <div className="w-20 shrink-0 px-2 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-500 flex items-center justify-center pointer-events-none">
                    Sec
                  </div>
                </div>
              ) : (
                <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                  type="number"
                  placeholder="No. of questions"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-sm"
                  value={questionCount}
                  onChange={(e) =>
                    setQuestionCount(
                      e.target.value === ""
                        ? ""
                        : parseInt(e.target.value) || 0,
                    )
                  }
                />
              )}
            </div>
          )}

          {selectedOps.length > 1 && (
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800 rounded-lg">
              <div>
                <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">Shuffle Operations</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Mix questions from selected types</p>
              </div>
              <button
                type="button"
                onClick={() => setPresetShuffle(!presetShuffle)}
                className={`relative w-10 h-5.5 transition-colors rounded-full ${presetShuffle ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-700"}`}
              >
                <span className={`absolute top-0.5 left-0.5 bg-white w-4.5 h-4.5 rounded-full transition-transform ${presetShuffle ? "translate-x-4.5" : "translate-x-0"}`}></span>
              </button>
            </div>
          )}

          {selectedOps.length > 0 && (
            <div className="mt-2 space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Operation Settings
              </label>
              {selectedOps.map((op) => {
                const opName =
                  op === "sq"
                    ? "Squares"
                    : op === "cube"
                      ? "Cubes"
                      : op === "frac"
                        ? "Fractions"
                        : op === "table"
                          ? "Multiplication Table"
                          : basicOperations.find((b) => b.op === op)?.name;
                return (
                  <div
                    key={op}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm"
                  >
                    <div
                      className={`w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${expandedOp === op ? 'rounded-t-lg' : 'rounded-lg'}`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedOp(expandedOp === op ? null : op)}
                        className="flex items-center gap-2 flex-1 text-left py-0.5 outline-none"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        {opName} Settings
                      </button>
                      
                      <div className="flex items-center gap-2">
                        {['sq', 'cube', 'frac', 'table'].includes(op) && (
                          <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setPresetOverrides((prev: any) => ({
                                  ...prev,
                                  [op]: { ...prev[op], isReverse: !(prev[op]?.isReverse) }
                                }));
                            }}
                            className={`p-1 rounded transition-colors ${presetOverrides[op]?.isReverse ? "text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10" : "text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"}`}
                            title="Reverse Mode"
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedOp(expandedOp === op ? null : op)}
                          className="outline-none"
                        >
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform ${expandedOp === op ? "rotate-180" : ""}`}
                          />
                        </button>
                      </div>
                    </div>
                    {expandedOp === op && (
                      <div className="p-4 bg-white dark:bg-[#1E1F25] border-t border-slate-200 dark:border-slate-700">
                        <OperationConfigurator
                          operation={op}
                          hideBaseSettings={true}
                          baseSettings={{ mode: presetMode, configMode: presetConfigMode }}
                          opSettings={{
                            mode: presetOverrides[op]?.mode,
                            duration: presetOverrides[op]?.duration,
                            questionCount: presetOverrides[op]?.questionCount,
                            difficulty:
                              presetOverrides[op]?.difficulty || "EASY",
                            customRanges:
                              presetOverrides[op]?.customRanges ?? "1-10",
                            isReverse: presetOverrides[op]?.isReverse,
                          }}
                          onChange={(_, newOpSettings) => {
                            setPresetOverrides((prev: any) => ({
                              ...prev,
                              [op]: newOpSettings,
                            }));
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {(() => {
            let estTime = 0;
            let estQs = 0;
            if (presetConfigMode === "GLOBAL") {
              if (presetMode === "TIME") {
                estTime = Number(timeLimit) || 0;
                estQs = Math.floor(estTime / 2);
              } else {
                estQs = Number(questionCount) || 0;
                estTime = estQs * 2;
              }
            } else {
              let tempTime = 0;
              let tempQs = 0;
              selectedOps.forEach(op => {
                const opSet = presetOverrides[op] || {};
                if (!opSet.mode || opSet.mode === "TIME") {
                  tempTime += Number(opSet.duration) || 0;
                } else {
                  tempQs += Number(opSet.questionCount) || 0;
                }
              });
              estTime = tempTime + (tempQs * 2);
              estQs = tempQs + Math.floor(tempTime / 2);
            }
            const mins = Math.floor(estTime / 60);
            const secs = estTime % 60;
            const timeString = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            return (
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-3 flex justify-between items-center">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Estimated Total</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  ~{timeString} • ~{estQs} Qs
                </span>
              </div>
            );
          })()}

          <div className="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 font-medium text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedOps.length === 0 || !newPresetName.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              Save Preset
            </button>
          </div>
        </form>
      </div>
    </div>, document.body
  );
}
