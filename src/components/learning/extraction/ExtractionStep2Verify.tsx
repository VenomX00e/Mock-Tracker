import React from 'react';
import {
  Loader2,
  Copy,
  Check,
  Sparkles,
  ArrowLeft,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ExtractionSourceType, ExtractionSourceMetadata } from '../../../types/extraction';
import { ExtractionCacheManager } from '../../../utils/extractionCacheManager';
import { VocabExtractionSettings } from '../../../types/learningSettings';

interface ExtractionStep2VerifyProps {
  sourceType: ExtractionSourceType;
  sourceMetadata: ExtractionSourceMetadata;
  rawWordCount: number;
  copied: boolean;
  handleCopyRawText: () => void;
  rawText: string;
  setRawText: (val: string) => void;
  customInstructions: string;
  setCustomInstructions: (val: string) => void;
  showInstructionField: boolean;
  setShowInstructionField: (val: boolean) => void;
  defaultsLoaded: boolean;
  globalDefaults: VocabExtractionSettings;
  setCurrentStep: (step: 1 | 2 | 3 | 4) => void;
  handleGenerateVocabulary: () => void;
  isLoading: boolean;
  loadingMessage: string;
}

export function ExtractionStep2Verify({
  sourceType,
  sourceMetadata,
  rawWordCount,
  copied,
  handleCopyRawText,
  rawText,
  setRawText,
  customInstructions,
  setCustomInstructions,
  showInstructionField,
  setShowInstructionField,
  defaultsLoaded,
  globalDefaults,
  setCurrentStep,
  handleGenerateVocabulary,
  isLoading,
  loadingMessage,
}: ExtractionStep2VerifyProps) {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Context Summary Header */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
            {sourceMetadata.title || 'Extracted Source'}
          </span>
          {sourceMetadata.channel && (
            <span className="text-slate-400 truncate">• {sourceMetadata.channel}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-mono text-[11px]">
            {rawWordCount} words
          </span>
          <button
            type="button"
            onClick={handleCopyRawText}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Raw Text Textarea */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Extracted Raw Text (Editable)
        </label>
        <textarea
          rows={9}
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            ExtractionCacheManager.saveSession({
              sourceType,
              sourceMetadata,
              rawText: e.target.value,
              customInstructions,
              aiOutput: null,
              currentStep: 2,
              lastUpdated: Date.now(),
            });
          }}
          placeholder="Raw text will appear here..."
          className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono leading-relaxed custom-scrollbar"
        />
      </div>

      {/* Custom AI Instructions Box (Collapsible, Collapsed by Default) */}
      <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-purple-50/40 dark:from-indigo-950/30 dark:via-slate-900/60 dark:to-purple-950/20 border border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl p-3.5 shadow-sm transition-all">
        {/* Header (Clickable Accordion Trigger) */}
        <div
          onClick={() => setShowInstructionField(!showInstructionField)}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl shadow-xs shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                  Custom AI Instructions & Master Prompt
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300">
                  {defaultsLoaded ? 'Platform Defaults Active' : 'Loading...'}
                </span>
                {!showInstructionField && customInstructions && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({customInstructions.length} chars)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {showInstructionField
                  ? 'These instructions will directly guide Gemini AI during vocabulary extraction.'
                  : 'Click to expand and view or customize master instructions.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] self-end sm:self-center">
            {showInstructionField && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomInstructions(globalDefaults.defaultCustomInstructions || '');
                  }}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Re-sync platform defaults
                </button>
                {customInstructions && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomInstructions('');
                    }}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              aria-label="Toggle instructions"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              {showInstructionField ? (
                <ChevronUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded Body */}
        {showInstructionField && (
          <div className="pt-3 space-y-2 border-t border-indigo-100 dark:border-indigo-900/40 mt-3 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="relative">
              <textarea
                rows={6}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Enter your custom system prompt or extraction instructions here..."
                className="w-full p-3 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono leading-relaxed custom-scrollbar"
              />
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 dark:text-slate-500 px-1">
                <span>Active Prompt Length: {customInstructions.length} characters</span>
                {customInstructions.trim() && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Custom instructions will override generic extraction defaults
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2 Bottom Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Source</span>
        </button>
        <button
          type="button"
          onClick={handleGenerateVocabulary}
          disabled={isLoading || !rawText.trim()}
          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{loadingMessage || 'Generating AI Vocabulary...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate AI Vocabulary & Review in Step 3</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
