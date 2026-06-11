import React from "react";
import { ToggleLeft, Save } from "lucide-react";

export interface AdminFeaturesTabProps {
  enableAiTutor: boolean;
  setEnableAiTutor: (val: boolean) => void;
  enableVocabulary: boolean;
  setEnableVocabulary: (val: boolean) => void;
  enableSpeedMath: boolean;
  setEnableSpeedMath: (val: boolean) => void;
  enablePracticeLibrary: boolean;
  setEnablePracticeLibrary: (val: boolean) => void;
  savingSettings: boolean;
  saveSettings: (silent?: boolean | React.FocusEvent<HTMLInputElement>) => void;
}

export function AdminFeaturesTab({
  enableAiTutor,
  setEnableAiTutor,
  enableVocabulary,
  setEnableVocabulary,
  enableSpeedMath,
  setEnableSpeedMath,
  enablePracticeLibrary,
  setEnablePracticeLibrary,
  savingSettings,
  saveSettings,
}: AdminFeaturesTabProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <ToggleLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />{" "}
          Feature Access
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto space-y-4">
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">AI Tutor</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Allow users to access the AI Tutor module.</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={enableAiTutor}
                  onChange={(e) => setEnableAiTutor(e.target.checked)}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${enableAiTutor ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${enableAiTutor ? 'transform translate-x-4' : ''}`}></div>
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Vocabulary</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Allow users to access the Vocabulary module.</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={enableVocabulary}
                  onChange={(e) => setEnableVocabulary(e.target.checked)}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${enableVocabulary ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${enableVocabulary ? 'transform translate-x-4' : ''}`}></div>
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Speed Math</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Allow users to access the Speed Math training module.</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={enableSpeedMath}
                  onChange={(e) => setEnableSpeedMath(e.target.checked)}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${enableSpeedMath ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${enableSpeedMath ? 'transform translate-x-4' : ''}`}></div>
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Practice Library</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Allow users to access the Practice Library.</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={enablePracticeLibrary}
                  onChange={(e) => setEnablePracticeLibrary(e.target.checked)}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${enablePracticeLibrary ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${enablePracticeLibrary ? 'transform translate-x-4' : ''}`}></div>
              </div>
            </label>
          </div>

          <button
            onClick={() => saveSettings(false)}
            disabled={savingSettings}
            className="mt-6 w-full justify-center inline-flex items-center px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />{" "}
            {savingSettings ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
