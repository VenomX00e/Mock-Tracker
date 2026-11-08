import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Search, 
  Trash2, 
  ArrowRight, 
  Zap, 
  Layers, 
  AlertTriangle,
  BookmarkX,
  Target
} from 'lucide-react';
import { useSeriesVault } from '../../../hooks/useSeriesVault';
import { SeriesPattern, SeriesCategory, SeriesPracticeLevel } from '../../../types/seriesTypes';

interface SeriesVaultDashboardProps {
  onStartPractice?: (pattern: SeriesPattern | 'ALL', level: SeriesPracticeLevel) => void;
}

export function SeriesVaultDashboard({ onStartPractice }: SeriesVaultDashboardProps) {
  const { patterns, removePattern } = useSeriesVault();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SeriesCategory | 'all'>('all');
  const [patternToDelete, setPatternToDelete] = useState<SeriesPattern | null>(null);
  const [levelSelectorPattern, setLevelSelectorPattern] = useState<SeriesPattern | 'ALL' | null>(null);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: patterns.length,
      difference: 0,
      multiplication: 0,
      powers: 0,
      primes: 0,
      alternating: 0,
    };
    patterns.forEach((p) => {
      const cat = p.category || 'difference';
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });
    return counts;
  }, [patterns]);

  const filteredPatterns = useMemo(() => {
    return patterns.filter((p) => {
      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesSearch = !searchQuery.trim() || 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.steps?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [patterns, selectedCategory, searchQuery]);

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

  const handleConfirmDelete = () => {
    if (patternToDelete) {
      removePattern(patternToDelete.id);
      setPatternToDelete(null);
    }
  };

  const handleTriggerLevelSelect = (target: SeriesPattern | 'ALL') => {
    if (onStartPractice) {
      setLevelSelectorPattern(target);
    }
  };

  const handleStartWithLevel = (level: SeriesPracticeLevel) => {
    if (levelSelectorPattern && onStartPractice) {
      onStartPractice(levelSelectorPattern, level);
      setLevelSelectorPattern(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-5 h-5" />
            </span>
            Pattern Vault
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Review and drill patterns saved from AI Tutor
          </p>
        </div>

        {patterns.length > 0 && (
          <button
            onClick={() => handleTriggerLevelSelect('ALL')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors self-start sm:self-auto"
          >
            <Target className="w-4 h-4" />
            <span>Drill All Saved (Mixed)</span>
          </button>
        )}
      </div>

      {/* Filter Bar & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'difference', label: 'Differences' },
              { key: 'multiplication', label: 'Multipliers' },
              { key: 'powers', label: 'Powers / Squares' },
              { key: 'primes', label: 'Primes' },
              { key: 'alternating', label: 'Alternating' },
            ] as const
          ).map((cat) => {
            const count = categoryCounts[cat.key] || 0;
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected 
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pattern or steps..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
      </div>

      {/* Pattern Cards Grid */}
      {filteredPatterns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPatterns.map((p) => (
            <div
              key={p.id}
              className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Top: Category Badge, Date, Delete Button */}
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${getCategoryColor(p.category)}`}>
                      {p.category}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      Saved {new Date(p.savedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <button
                    onClick={() => setPatternToDelete(p)}
                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    title="Delete Pattern"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>{p.title}</span>
                </h3>

                {/* Step Progression Pills */}
                {p.steps && p.steps.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-thin">
                    {p.steps.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-slate-100 dark:bg-slate-700/70 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600 whitespace-nowrap">
                          {step}
                        </span>
                        {idx < p.steps.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex justify-end">
                <button
                  onClick={() => handleTriggerLevelSelect(p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-lg transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Practice Pattern</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mb-3">
            <BookmarkX className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            {patterns.length === 0 ? 'No patterns saved yet' : 'No matching patterns'}
          </h4>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-md">
            {patterns.length === 0 
              ? 'Ask the AI Tutor in Quant mode to identify any number series and click "Save Pattern" to store it here for targeted drills.'
              : 'Try clearing your search query or selecting a different category filter above.'}
          </p>
        </div>
      )}

      {/* Level Selector Modal */}
      {levelSelectorPattern && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Select Practice Level
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {levelSelectorPattern === 'ALL'
                ? 'Drilling all saved patterns'
                : levelSelectorPattern.title}
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => handleStartWithLevel(1)}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all text-left"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Level 1 — Foundation
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Small base numbers (1–10) & initial consecutive steps
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded">
                  L1
                </span>
              </button>

              <button
                onClick={() => handleStartWithLevel(2)}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all text-left"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Level 2 — Intermediate (Exam Standard)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mid-range base numbers (15–60) & shifted offsets
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded">
                  L2
                </span>
              </button>

              <button
                onClick={() => handleStartWithLevel(3)}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all text-left"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Level 3 — Advanced (Skip Gaps & Higher Range)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Alternate skips (odd squares, prime gaps) & higher domain
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded">
                  L3
                </span>
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setLevelSelectorPattern(null)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {patternToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-xl">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Pattern?
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
              Are you sure you want to remove <span className="font-semibold text-slate-900 dark:text-white">"{patternToDelete.title}"</span> from your Pattern Vault?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setPatternToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
