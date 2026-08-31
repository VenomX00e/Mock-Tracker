import React from 'react';
import { GraduationCap, Sparkles } from 'lucide-react';
import { VocabSettingsPanel } from './VocabSettingsPanel';

export function AdminLearningSettingsTab() {
  return (
    <div className="flex flex-col h-full w-full bg-slate-50/50 dark:bg-slate-900/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200">
              Learning Settings
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure global AI prompts, CEFR levels, and learning platform automation
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto space-y-6">
          {/* Sub-section: Vocabulary Page Configuration */}
          <VocabSettingsPanel />
        </div>
      </div>
    </div>
  );
}
