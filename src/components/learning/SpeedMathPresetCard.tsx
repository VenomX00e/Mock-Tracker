import React from "react";
import { MathPreset } from "../../store/speedMathStore";
import { Settings, Trash2, Play, Star } from "lucide-react";

interface SpeedMathPresetCardProps {
  preset: MathPreset;
  handleStartPreset: (preset: MathPreset) => void;
  handleOpenEditPreset: (preset: MathPreset) => void;
  removePreset: (id: string) => void;
  updatePreset: (id: string, updates: Partial<MathPreset>) => void;
  canManageLearning: boolean;
}

export function SpeedMathPresetCard({
  preset,
  handleStartPreset,
  handleOpenEditPreset,
  removePreset,
  updatePreset,
  canManageLearning,
}: SpeedMathPresetCardProps) {
  const showAdminControls = !preset.isDefault || canManageLearning;

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col gap-3 relative">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-sm md:text-base font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
            {preset.name}
            {preset.isDefault && (
              <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 rounded">
                Default
              </span>
            )}
          </h4>
          <div className="flex gap-2 flex-wrap mt-2">
            {preset.operations.map((op) => (
              <span
                key={op}
                className="text-[10px] md:text-xs font-medium px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm border border-transparent dark:border-slate-700 block"
              >
                {op.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
        {showAdminControls && (
          <div className="flex gap-1 justify-end items-center">
            {canManageLearning && (
              <button
                onClick={() =>
                  updatePreset(preset.id, { isDefault: !preset.isDefault })
                }
                className={`transition-colors p-1 ${preset.isDefault ? "text-amber-500" : "text-slate-400 hover:text-amber-500"}`}
                title={preset.isDefault ? "Remove Default" : "Make Default"}
              >
                <Star
                  className="w-4 h-4"
                  fill={preset.isDefault ? "currentColor" : "none"}
                />
              </button>
            )}
            <button
              onClick={() => handleOpenEditPreset(preset)}
              className="text-slate-400 hover:text-indigo-500 transition-colors p-1"
              title="Edit Preset"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => removePreset(preset.id)}
              className="text-slate-400 hover:text-red-500 transition-colors p-1"
              title="Delete Preset"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-2 flex gap-4">
        {preset.baseSettings?.mode === "QUESTIONS" ? (
          <span>Questions: {preset.baseSettings.questionCount}</span>
        ) : (
          <span>
            Time:{" "}
            {preset.baseSettings?.duration || (preset as any).timeLimit || 60}s
          </span>
        )}
      </div>
      <button
        onClick={() => handleStartPreset(preset)}
        className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs md:text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        <Play className="w-4 h-4" /> Start
      </button>
    </div>
  );
}
