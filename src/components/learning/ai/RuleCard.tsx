import React, { useState, useMemo } from 'react';
import { BookOpen, Copy, Check, Zap, ArrowRightLeft, CheckCircle2, XCircle, Sparkles, Loader2, Bookmark, BookmarkCheck } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useRuleBook, GrammarBlueprint } from '../../../hooks/useRuleBook';

interface RuleCardProps {
  content?: string;
  data?: GrammarBlueprint;
}

interface FormulaItem {
  text: string;
  isValid: boolean;
}

interface GrammarBlueprintData {
  ruleName?: string;
  category?: string;
  originalSentenceBreakdown?: {
    prefix: string;
    errorText: string;
    correctText: string;
    suffix: string;
  };
  spottingStrategy?: string;
  formulas?: Array<{ text?: string; isValid?: boolean }>;
  example?: {
    incorrect?: string;
    correct?: string;
  };
}

export function RuleCard({ content, data: directData }: RuleCardProps) {
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isBouncing, setIsBouncing] = useState(false);

  const { isRuleSaved, toggleSaveRule } = useRuleBook();

  // Pure JSON data extraction and parsing
  const { data, isStreaming, rawFallback } = useMemo(() => {
    if (directData && (directData.ruleName || (directData.formulas && directData.formulas.length > 0))) {
      return { data: directData, isStreaming: false, rawFallback: null };
    }

    if (!content) {
      return { data: null, isStreaming: true, rawFallback: null };
    }

    let cleaned = content.trim();

    // Strip markdown code block wrappers if present
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    // 1. Direct JSON Parse Attempt
    try {
      const parsedObj = JSON.parse(cleaned);
      const blueprint: GrammarBlueprintData = parsedObj.grammarBlueprint || parsedObj;

      if (blueprint && (blueprint.ruleName || (blueprint.formulas && blueprint.formulas.length > 0))) {
        return {
          data: blueprint,
          isStreaming: false,
          rawFallback: null,
        };
      }
    } catch {
      // 2. Try extracting JSON between first '{' and last '}'
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const jsonSub = cleaned.slice(firstBrace, lastBrace + 1);
        try {
          // Remove potential trailing commas before closing braces/brackets
          const sanitized = jsonSub.replace(/,\s*([}\]])/g, '$1');
          const parsedObj = JSON.parse(sanitized);
          const blueprint: GrammarBlueprintData = parsedObj.grammarBlueprint || parsedObj;

          if (blueprint && (blueprint.ruleName || (blueprint.formulas && blueprint.formulas.length > 0))) {
            return {
              data: blueprint,
              isStreaming: false,
              rawFallback: null,
            };
          }
        } catch {
          // Continue to fallback parsing
        }
      }

      // 3. Fallback field extraction if JSON has minor unescaped quotes
      try {
        const ruleNameMatch = /"ruleName"\s*:\s*"([^"]+)"/i.exec(cleaned);
        const spottingStrategyMatch = /"spottingStrategy"\s*:\s*"([^"]+)"/i.exec(cleaned);
        const incMatch = /"incorrect"\s*:\s*"([^"]+)"/i.exec(cleaned);
        const corMatch = /"correct"\s*:\s*"([^"]+)"/i.exec(cleaned);

        // Extract formulas array items
        const formulas: Array<{ text: string; isValid: boolean }> = [];
        const formulaBlockMatch = /"formulas"\s*:\s*\[([\s\S]*?)\]/i.exec(cleaned);
        if (formulaBlockMatch) {
          const itemRegex = /\{\s*"text"\s*:\s*"([^"]+)"\s*,\s*"isValid"\s*:\s*(true|false)/gi;
          let itemMatch: RegExpExecArray | null;
          while ((itemMatch = itemRegex.exec(formulaBlockMatch[1])) !== null) {
            formulas.push({
              text: itemMatch[1],
              isValid: itemMatch[2].toLowerCase() === 'true',
            });
          }
        }

        if (ruleNameMatch || formulas.length > 0) {
          return {
            data: {
              ruleName: ruleNameMatch ? ruleNameMatch[1] : 'Grammar Principle',
              formulas,
              spottingStrategy: spottingStrategyMatch ? spottingStrategyMatch[1] : undefined,
              example: (incMatch || corMatch) ? {
                incorrect: incMatch ? incMatch[1] : undefined,
                correct: corMatch ? corMatch[1] : undefined,
              } : undefined,
            },
            isStreaming: false,
            rawFallback: null,
          };
        }
      } catch {
        // Fall through
      }

      // 4. If it's truly an incomplete in-flight stream
      if (cleaned.includes('"grammarBlueprint"') && !cleaned.includes('}')) {
        return {
          data: null,
          isStreaming: true,
          rawFallback: null,
        };
      }
    }

    // 5. Fallback if legacy non-JSON markdown text was passed
    return {
      data: null,
      isStreaming: false,
      rawFallback: content,
    };
  }, [content]);

  const isSaved = isRuleSaved(data?.ruleName);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (content) {
      navigator.clipboard.writeText(content);
    } else if (data) {
      navigator.clipboard.writeText(JSON.stringify({ grammarBlueprint: data }, null, 2));
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBookmarkToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data || !data.ruleName) return;

    setIsBouncing(true);
    setTimeout(() => setIsBouncing(false), 400);

    const result = toggleSaveRule(data as GrammarBlueprint);
    setToastMessage(result.message);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Helper to render example sentence with bracket highlighting
  const renderHighlightedSentence = (
    text?: string,
    isError = false,
    counterpartText?: string
  ) => {
    if (!text) return null;

    // Check if explicit bracketed segment exists e.g. "Two roads were built, but [every of them] failed."
    const bracketRegex = /\[(.*?)\]/;
    const bracketMatch = bracketRegex.exec(text);

    if (bracketMatch) {
      const parts = text.split(bracketRegex);
      return (
        <span className="leading-relaxed">
          {parts[0]}
          <span
            className={`inline-block mx-1 px-1.5 py-0.5 rounded text-[11.5px] sm:text-xs font-bold ${
              isError
                ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 line-through decoration-rose-600'
                : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 underline decoration-emerald-500 underline-offset-2'
            }`}
          >
            {bracketMatch[1]}
          </span>
          {parts[2] || ''}
        </span>
      );
    }

    // Smart Auto-Diff: If no brackets were provided, highlight words that differ
    if (counterpartText) {
      const wordsA = text.split(/(\s+)/);
      const cleanCounterpart = counterpartText.replace(/\[|\]/g, '').toLowerCase();

      const hasDifferences = wordsA.some(w => w.trim().length > 1 && !cleanCounterpart.includes(w.trim().toLowerCase()));

      if (hasDifferences) {
        return (
          <span className="leading-relaxed">
            {wordsA.map((word, idx) => {
              const trimmed = word.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
              const isDiff = trimmed.length > 0 && !cleanCounterpart.includes(trimmed.toLowerCase());

              if (isDiff) {
                return (
                  <span
                    key={idx}
                    className={`inline-block mx-0.5 px-1 py-0.5 rounded text-[11.5px] sm:text-xs font-bold ${
                      isError
                        ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 line-through decoration-rose-600'
                        : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 underline decoration-emerald-500 underline-offset-2'
                    }`}
                  >
                    {word}
                  </span>
                );
              }
              return <React.Fragment key={idx}>{word}</React.Fragment>;
            })}
          </span>
        );
      }
    }

    return (
      <span className={isError ? 'font-medium text-slate-800 dark:text-rose-100' : 'font-semibold text-slate-900 dark:text-emerald-100'}>
        {text}
      </span>
    );
  };

  // 1. Streaming / Loading Skeleton View
  if (isStreaming && !data) {
    return (
      <div className="relative my-3.5 p-4 sm:p-5 bg-gradient-to-br from-indigo-50/70 via-blue-50/30 to-slate-50 dark:from-indigo-950/30 dark:via-slate-900/80 dark:to-indigo-950/20 border border-indigo-200/70 dark:border-indigo-800/60 border-l-4 border-l-indigo-500 rounded-xl shadow-2xs animate-pulse">
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-indigo-100 dark:border-indigo-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-500 text-white rounded-lg shadow-2xs">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <span>Grammar Blueprint</span>
                <Sparkles className="w-3 h-3 text-amber-500" />
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Synthesizing Grammar Blueprint...
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="h-12 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-indigo-100/60 dark:border-indigo-900/40" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="h-16 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-indigo-100/60 dark:border-indigo-900/40" />
            <div className="h-16 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-indigo-100/60 dark:border-indigo-900/40" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Legacy Raw Markdown View
  if (rawFallback && !data) {
    return (
      <div className="relative my-3.5 p-4 sm:p-5 bg-gradient-to-br from-indigo-50/90 via-blue-50/40 to-slate-50 dark:from-indigo-950/40 dark:via-slate-900/90 dark:to-indigo-950/20 border border-indigo-200/90 dark:border-indigo-800/70 border-l-4 border-l-indigo-600 dark:border-l-indigo-400 rounded-xl shadow-2xs">
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-indigo-100 dark:border-indigo-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-2xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="text-xs sm:text-[13.5px] font-bold text-slate-900 dark:text-white">
              Grammar Rule Summary
            </div>
          </div>
        </div>
        <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed space-y-2">
          <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {rawFallback}
          </Markdown>
        </div>
      </div>
    );
  }

  // 3. Pure Data-Driven Visual Grammar Blueprint
  const ruleTitle = data?.ruleName || 'Grammar Principle';
  const originalSentenceBreakdown = data?.originalSentenceBreakdown;
  const spottingStrategy = data?.spottingStrategy;
  const formulas = data?.formulas || [];
  const example = data?.example;

  return (
    <div className="relative my-3.5 p-4 sm:p-5 bg-gradient-to-br from-indigo-50/90 via-blue-50/40 to-slate-50 dark:from-indigo-950/40 dark:via-slate-900/90 dark:to-indigo-950/20 border border-indigo-200/90 dark:border-indigo-800/70 border-l-4 border-l-indigo-600 dark:border-l-indigo-400 rounded-xl shadow-2xs transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-indigo-100 dark:border-indigo-900/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg shadow-2xs shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
              <span>Grammar Blueprint</span>
              <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
            </div>
            <div className="text-xs sm:text-[13.5px] font-bold text-slate-900 dark:text-white leading-tight truncate">
              {ruleTitle}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1 shrink-0 relative">
          {/* Toast Notification Pill */}
          {toastMessage && (
            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-semibold rounded-full shadow-md whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-90 duration-150 z-20">
              {toastMessage}
            </div>
          )}

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={handleBookmarkToggle}
            className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold ${
              isBouncing ? 'scale-125' : 'scale-100'
            } ${
              isSaved
                ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/60'
            }`}
            title={isSaved ? 'Saved in RuleBook (click to remove)' : 'Save to RuleBook'}
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="w-3.5 h-3.5 fill-amber-500 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save Rule</span>
              </>
            )}
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/60 rounded-md transition-colors cursor-pointer"
            title="Copy grammar rule"
          >
            {copied ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" /> Copied
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold">
                <Copy className="w-3.5 h-3.5" /> Copy
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Structured Blueprint Layout */}
      <div className="space-y-3">
        {/* 🔍 1. Your Sentence Breakdown */}
        {originalSentenceBreakdown && (
          <div className="p-3 rounded-xl bg-white/95 dark:bg-slate-900/90 border border-indigo-200/90 dark:border-indigo-800/80 shadow-2xs">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
              <span>🔍 Your Sentence Breakdown</span>
            </div>

            {/* 2-Row Compact Breakdown */}
            <div className="space-y-1.5">
              {/* Row 1: Original */}
              <div className="flex gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="shrink-0 text-rose-500/80 select-none">❌</span>
                <p>
                  {originalSentenceBreakdown.prefix && <span>{originalSentenceBreakdown.prefix} </span>}
                  <span className="line-through text-rose-500 font-medium">
                    {originalSentenceBreakdown.errorText}
                  </span>
                  {originalSentenceBreakdown.suffix && <span> {originalSentenceBreakdown.suffix}</span>}
                </p>
              </div>

              {/* Row 2: Corrected */}
              <div className="flex gap-2 text-sm text-slate-800 dark:text-slate-200">
                <span className="shrink-0 text-emerald-500/80 select-none">✅</span>
                <p>
                  {originalSentenceBreakdown.prefix && <span>{originalSentenceBreakdown.prefix} </span>}
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {originalSentenceBreakdown.correctText}
                  </span>
                  {originalSentenceBreakdown.suffix && <span> {originalSentenceBreakdown.suffix}</span>}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 🕵️ 2. Spotting Strategy */}
        {spottingStrategy && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1">
              🕵️ Spotting Strategy
            </h4>
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed markdown-body">
              <Markdown
                components={{
                  strong: ({node, ...props}) => <strong className="font-semibold text-amber-700 dark:text-amber-400" {...props} />,
                  code: ({node, ...props}) => <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-amber-600 dark:text-amber-300 font-mono text-[13px]" {...props} />
                }}
              >
                {spottingStrategy}
              </Markdown>
            </div>
          </div>
        )}

        {/* 🎯 3. Core Grammar Formulas */}
        {formulas.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1">
              📐 Core Grammar Formulas
            </h4>
            <div className="space-y-2">
              {formulas.map((item, idx) => {
                const isValid = item.isValid !== false;
                return (
                  <div
                    key={idx}
                    className={`text-[13px] leading-relaxed flex items-start gap-3 p-3 rounded-r-xl rounded-l-sm shadow-sm relative overflow-hidden transition-colors ${
                      isValid
                        ? 'bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-950/20 border-y border-r border-slate-200 dark:border-slate-800 border-l-[4px] border-l-emerald-500'
                        : 'bg-gradient-to-r from-rose-50/80 to-transparent dark:from-rose-950/20 border-y border-r border-slate-200 dark:border-slate-800 border-l-[4px] border-l-rose-500'
                    }`}
                  >
                    {!isValid ? (
                      <div className="mt-0.5 shrink-0 bg-white dark:bg-slate-900 rounded-full shadow-sm">
                        <XCircle className="w-4 h-4 text-rose-500" />
                      </div>
                    ) : (
                      <div className="mt-0.5 shrink-0 bg-white dark:bg-slate-900 rounded-full shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                    )}
                    <span className="markdown-body flex-1 text-slate-700 dark:text-slate-300">
                      <Markdown
                        components={{
                          strong: ({node, ...props}) => <strong className="font-bold text-slate-900 dark:text-slate-100 tracking-tight" {...props} />,
                          code: ({node, ...props}) => <code className="px-1.5 py-0.5 mx-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded text-indigo-600 dark:text-indigo-400 font-mono text-[12px] font-bold" {...props} />,
                          em: ({node, ...props}) => <em className="text-slate-500 dark:text-slate-400 italic text-[11.5px] ml-1" {...props} />,
                          p: ({node, ...props}) => <span {...props} />
                        }}
                      >
                        {item.text || ''}
                      </Markdown>
                    </span>
                    {!isValid && (
                      <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 1px, transparent 10px)' }}></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}



        {/* ⚖️ 3. Full Sentence Example */}
        {example && (example.incorrect || example.correct) && (
          <div className="p-3 rounded-lg bg-slate-900/5 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
              <span>⚖️ Clean Sentence Example</span>
            </div>
            <div className="space-y-2 text-xs sm:text-[12.5px]">
              {example.incorrect && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-50/90 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/60">
                  <span className="shrink-0 font-bold text-rose-600 dark:text-rose-400">❌</span>
                  <div className="text-rose-950 dark:text-rose-100">
                    {renderHighlightedSentence(example.incorrect, true, example.correct)}
                  </div>
                </div>
              )}
              {example.correct && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60">
                  <span className="shrink-0 font-bold text-emerald-600 dark:text-emerald-400">✓</span>
                  <div className="text-emerald-950 dark:text-emerald-100">
                    {renderHighlightedSentence(example.correct, false, example.incorrect)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
