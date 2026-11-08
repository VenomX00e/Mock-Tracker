import React, { useState, useMemo } from 'react';
import { Bookmark, BookmarkCheck, ArrowRight, Hash, Sparkles, Loader2 } from 'lucide-react';
import { SeriesPattern, SeriesCategory } from '../../../types/seriesTypes';
import { useSeriesVault } from '../../../hooks/useSeriesVault';

interface SeriesPatternCardProps {
  content?: string;
  data?: Partial<SeriesPattern>;
}

export function SeriesPatternCard({ content, data: directData }: SeriesPatternCardProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isBouncing, setIsBouncing] = useState(false);
  const { isPatternSaved, toggleSavePattern } = useSeriesVault();

  // Parse pattern data from direct prop or raw/streaming JSON block
  const { pattern } = useMemo<{ pattern: Partial<SeriesPattern> | null; isStreaming: boolean }>(() => {
    if (directData && directData.title && directData.steps) {
      return { pattern: directData, isStreaming: false };
    }

    if (!content) return { pattern: null, isStreaming: true };

    let cleaned = content.trim();
    cleaned = cleaned.replace(/^```(?:json)?(?::seriesBlueprint)?\s*/i, '').replace(/```\s*$/i, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      const bp = parsed.seriesBlueprint || parsed;
      if (bp && bp.title) {
        return { pattern: bp, isStreaming: false };
      }
    } catch {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
          const bp = parsed.seriesBlueprint || parsed;
          if (bp && bp.title) {
            return { pattern: bp, isStreaming: false };
          }
        } catch {
          // Fall through to partial regex extraction while streaming
        }
      }
    }

    // Progressive partial extraction while JSON is still streaming
    const idMatch = /"id"\s*:\s*"([^"]+)"/i.exec(cleaned);
    const titleMatch = /"title"\s*:\s*"([^"]+)"/i.exec(cleaned);
    const categoryMatch = /"category"\s*:\s*"([^"]+)"/i.exec(cleaned);
    const stepsBlockMatch = /"steps"\s*:\s*\[([^\]]*)/i.exec(cleaned);
    const partialSteps: string[] = [];
    if (stepsBlockMatch && stepsBlockMatch[1]) {
      const stepItemRegex = /"([^"]+)"/g;
      let sm: RegExpExecArray | null;
      while ((sm = stepItemRegex.exec(stepsBlockMatch[1])) !== null) {
        partialSteps.push(sm[1]);
      }
    }

    if (titleMatch || categoryMatch || partialSteps.length > 0) {
      return {
        pattern: {
          id: idMatch?.[1],
          title: titleMatch?.[1] || 'Building Series Pattern...',
          category: (categoryMatch?.[1] as SeriesCategory) || 'difference',
          steps: partialSteps,
        },
        isStreaming: true,
      };
    }

    return { pattern: null, isStreaming: true };
  }, [content, directData]);

  if (!pattern) {
    return (
      <div className="my-3 rounded-xl border border-indigo-200/70 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-slate-900/70 p-3.5 flex items-center gap-2.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-500 shrink-0" />
        <span>Building Number Series Pattern Card...</span>
      </div>
    );
  }

  const patternId = pattern.id || pattern.title.toLowerCase().replace(/\s+/g, '-');
  const isSaved = isPatternSaved(patternId);

  const handleToggleSave = async () => {
    setIsBouncing(true);
    setTimeout(() => setIsBouncing(false), 400);

    const result = await toggleSavePattern({
      id: patternId,
      title: pattern.title || 'Untitled Pattern',
      category: (pattern.category as SeriesCategory) || 'difference',
      steps: pattern.steps || [],
      generatorKey: pattern.generatorKey || 'custom_pattern',
      generatorParams: pattern.generatorParams || {},
    });

    setToastMessage(result.saved ? 'Pattern saved to Vault!' : 'Removed from Vault');
    setTimeout(() => setToastMessage(null), 2200);
  };

  const getCategoryColor = (cat?: string) => {
    switch (cat) {
      case 'primes':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'multiplication':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'powers':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'alternating':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
    }
  };

  return (
    <div className="relative my-3 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/40 dark:from-slate-900/90 dark:via-slate-900/95 dark:to-indigo-950/40 p-4 shadow-sm hover:shadow-md transition-all text-slate-800 dark:text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute -top-3 right-4 z-20 px-2.5 py-1 text-xs font-semibold rounded-full shadow-lg bg-slate-900 text-white dark:bg-emerald-600 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {toastMessage}
        </div>
      )}

      {/* Top Row: Icon + Header + Category Pill + Save Button */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-indigo-100 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Hash className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 truncate">
            Number Series Pattern
          </span>
          {pattern.category && (
            <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full border shrink-0 ${getCategoryColor(pattern.category)}`}>
              {pattern.category}
            </span>
          )}
        </div>

        {/* Save Pattern Toggle Button */}
        <button
          onClick={handleToggleSave}
          title={isSaved ? "Remove from Pattern Vault" : "Save Pattern to Vault"}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 active:scale-95 ${
            isSaved
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
          } ${isBouncing ? 'scale-105' : ''}`}
        >
          {isSaved ? (
            <>
              <BookmarkCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
              <span>Save Pattern</span>
            </>
          )}
        </button>
      </div>

      {/* Pattern Title */}
      <div className="mt-3">
        <div className="text-sm md:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>{pattern.title}</span>
        </div>
      </div>

      {/* Steps Row: Horizontal Pills with Arrows */}
      {pattern.steps && pattern.steps.length > 0 && (
        <div className="mt-3 pt-2">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Step Progression
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {pattern.steps.map((step, idx) => (
              <React.Fragment key={idx}>
                <div className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/80 shadow-xs whitespace-nowrap shrink-0">
                  {step}
                </div>
                {idx < pattern.steps!.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
