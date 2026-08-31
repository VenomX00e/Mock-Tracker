import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  getLearningSettings,
  saveLearningSettings,
} from '../../services/learningSettingsFirebaseService';
import {
  VocabExtractionSettings,
  DEFAULT_VOCAB_EXTRACTION_SETTINGS,
} from '../../types/learningSettings';

export function VocabSettingsPanel() {
  const [settings, setSettings] = useState<VocabExtractionSettings>(
    DEFAULT_VOCAB_EXTRACTION_SETTINGS
  );
  const [initialSettings, setInitialSettings] = useState<VocabExtractionSettings>(
    DEFAULT_VOCAB_EXTRACTION_SETTINGS
  );
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load settings on mount
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const data = await getLearningSettings();
        if (isMounted) {
          setSettings(data.vocabExtraction);
          setInitialSettings(data.vocabExtraction);
          setUpdatedAt(data.updatedAt || null);
        }
      } catch (err: any) {
        console.error('Failed to load learning settings:', err);
        if (isMounted) {
          setToast({
            type: 'error',
            message: 'Failed to load existing vocabulary settings. Using defaults.',
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const hasChanges =
    (settings.defaultCustomInstructions || '') !== (initialSettings.defaultCustomInstructions || '');

  const handleSave = async () => {
    setIsSaving(true);
    setToast(null);
    try {
      await saveLearningSettings({
        vocabExtraction: settings,
      });
      setInitialSettings(settings);
      setUpdatedAt(new Date().toISOString());
      setToast({
        type: 'success',
        message: 'Vocabulary custom instructions updated and saved successfully!',
      });
    } catch (err: any) {
      console.error('Failed to save learning settings:', err);
      setToast({
        type: 'error',
        message: 'Failed to save changes. Please check permissions and try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setSettings(DEFAULT_VOCAB_EXTRACTION_SETTINGS);
  };

  if (isLoading) {
    return (
      <div id="vocab-settings-loading" className="p-8 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading vocabulary configuration...
        </p>
      </div>
    );
  }

  return (
    <div id="vocab-settings-panel" className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          id="vocab-settings-toast"
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between shadow-sm border transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            id="dismiss-toast-btn"
            onClick={() => setToast(null)}
            className="text-xs font-bold uppercase tracking-wider opacity-70 hover:opacity-100 ml-4 px-2 py-1 rounded cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Vocabulary Configuration Card */}
      <div id="vocab-config-card" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Vocabulary Extraction Custom Instructions
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure the master prompt instructions provided to Gemini AI during vocabulary extraction across the platform.
              </p>
            </div>
          </div>

          {updatedAt && (
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                Updated {new Date(updatedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Custom AI Instructions Box */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="custom-instructions-textarea" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Default Custom AI Instructions & Master Prompt
            </label>
            <span className="text-[11px] text-slate-400">
              {settings.defaultCustomInstructions?.length || 0} characters
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Paste your custom vocabulary extraction prompt here. These instructions will be directly provided to Gemini AI during all vocabulary extractions across the platform without interference from artificial constraints.
          </p>

          <textarea
            id="custom-instructions-textarea"
            rows={14}
            value={settings.defaultCustomInstructions || ''}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                defaultCustomInstructions: e.target.value,
              }))
            }
            placeholder="Paste your custom prompt / instructions here (e.g. Role & Objective, Core Processing Rules, Exclusion Rules, Output Formatting Blueprint)..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed transition-all font-mono custom-scrollbar"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-100 dark:border-slate-700">
          <button
            type="button"
            id="reset-defaults-btn"
            onClick={handleResetToDefaults}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear / Reset Instructions
          </button>

          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Unsaved changes
              </span>
            )}
            <button
              type="button"
              id="save-instructions-btn"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving Changes...' : 'Save Instructions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
