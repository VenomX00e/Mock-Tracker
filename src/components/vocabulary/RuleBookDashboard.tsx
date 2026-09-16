import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Search,
  Download,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  X,
  RotateCcw,
} from 'lucide-react';
import { useRuleBook, SavedRule } from '../../hooks/useRuleBook';
import { RuleCard } from '../learning/ai/RuleCard';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../ui/Accordion';
import { Badge } from '../ui/Badge';

export function RuleBookDashboard() {
  const {
    rules,
    removeRule,
    restoreRule,
    exportRulesAsFile,
    importRules,
  } = useRuleBook();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [openAccordionValues, setOpenAccordionValues] = useState<string[]>([]);
  const [ruleToDelete, setRuleToDelete] = useState<SavedRule | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
    deletedRule?: SavedRule;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear notification timer on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  // 10 Official categories
  const OFFICIAL_CATEGORIES = useMemo(() => [
    "Subject-Verb Agreement",
    "Verb Tenses & Conditionals",
    "Pronoun Reference & Agreement",
    "Modifiers (Misplaced & Dangling)",
    "Parallelism & Structure",
    "Prepositions & Idioms",
    "Nouns & Articles",
    "Conjunctions & Clauses",
    "Word Choice & Redundancy",
    "General Grammar"
  ], []);

  // Dynamically generate unique categories and their item counts
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    
    for (const cat of OFFICIAL_CATEGORIES) {
      counts[cat] = 0;
    }

    for (const r of rules) {
      // Graceful fallback for legacy rules
      const cat = r.category || 'General Grammar';
      const effectiveCategory = OFFICIAL_CATEGORIES.includes(cat) ? cat : "General Grammar";
      counts[effectiveCategory] += 1;
    }

    // Only render a pill if that category has 1 or more saved rules
    return OFFICIAL_CATEGORIES
      .filter((name) => counts[name] > 0)
      .map((name) => ({
        name,
        count: counts[name],
      }));
  }, [rules, OFFICIAL_CATEGORIES]);

  // Search & category filtering pipeline
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      // Graceful fallback for legacy rules
      const rawCat = rule.category || 'General Grammar';
      const effectiveCategory = OFFICIAL_CATEGORIES.includes(rawCat) ? rawCat : "General Grammar";

      // 1. Category Filter
      if (selectedCategory !== 'ALL' && effectiveCategory !== selectedCategory) {
        return false;
      }

      // 2. Search Query Filter (Checks ruleName, spottingStrategy, fixReason, category, formulas)
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const name = (rule.blueprint?.ruleName || '').toLowerCase();
      const strategy = (rule.blueprint?.spottingStrategy || '').toLowerCase();
      const fixReason = (rule.blueprint?.originalSentenceBreakdown?.fixReason || '').toLowerCase();
      const cat = effectiveCategory.toLowerCase();
      const formulas = (rule.blueprint?.formulas || [])
        .map((f) => f.text.toLowerCase())
        .join(' ');

      return (
        name.includes(q) ||
        strategy.includes(q) ||
        fixReason.includes(q) ||
        cat.includes(q) ||
        formulas.includes(q)
      );
    });
  }, [rules, selectedCategory, searchQuery, OFFICIAL_CATEGORIES]);

  // Quick accordion expansion handlers
  const handleExpandAll = () => {
    setOpenAccordionValues(filteredRules.map((r) => r.id));
  };

  const handleCollapseAll = () => {
    setOpenAccordionValues([]);
  };

  // Confirm delete rule
  const handleConfirmDelete = () => {
    if (!ruleToDelete) return;
    const ruleName = ruleToDelete.blueprint?.ruleName || 'Rule';
    const deleted = { ...ruleToDelete };
    removeRule(ruleToDelete.id);
    setRuleToDelete(null);

    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    setNotification({
      type: 'success',
      message: `"${ruleName}" removed from RuleBook`,
      deletedRule: deleted,
    });

    // Display for 7 seconds as requested
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
    }, 7000);
  };

  // Restore deleted rule
  const handleRestore = (ruleToRestore: SavedRule) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    const res = restoreRule(ruleToRestore);
    const ruleName = ruleToRestore.blueprint?.ruleName || 'Rule';

    if (res.success) {
      setNotification({
        type: 'success',
        message: `"${ruleName}" restored to RuleBook`,
      });
      notificationTimeoutRef.current = setTimeout(() => {
        setNotification(null);
      }, 4000);
    } else {
      setNotification({
        type: 'error',
        message: res.message,
      });
      notificationTimeoutRef.current = setTimeout(() => {
        setNotification(null);
      }, 4000);
    }
  };

  // Import JSON file reader
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }

      try {
        const text = event.target?.result as string;
        const res = importRules(text);
        if (res.success) {
          setNotification({ type: 'success', message: res.message });
        } else {
          setNotification({ type: 'error', message: res.message });
        }
      } catch {
        setNotification({
          type: 'error',
          message: 'Failed to read JSON backup file',
        });
      }

      notificationTimeoutRef.current = setTimeout(() => setNotification(null), 4000);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full flex flex-col gap-5 animate-in fade-in duration-200">
      {/* Hidden File Input for JSON import */}
      <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Header & Backup Tools */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
              Grammar RuleBook
            </h2>
            <Badge variant="amber">{rules.length} Saved</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Saved grammar rules and formulas • Stored locally
          </p>
        </div>

        {/* Export & Import Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Import RuleBook backup (.json)"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-500" />
            <span>Import JSON</span>
          </button>

          <button
            type="button"
            onClick={() => exportRulesAsFile('rulebook_backup.json')}
            disabled={rules.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Export and download RuleBook as a JSON backup file"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" />
            <span>Export Backup</span>
          </button>
        </div>
      </div>

      {/* Import / Delete Notification Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl text-xs sm:text-sm font-medium animate-in slide-in-from-top-2 border ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="truncate">{notification.message}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {notification.deletedRule && (
              <button
                type="button"
                onClick={() => handleRestore(notification.deletedRule!)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200 hover:text-emerald-950 dark:hover:text-white bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 dark:hover:bg-emerald-800/90 rounded-lg transition-colors border border-emerald-300 dark:border-emerald-700/80 cursor-pointer shadow-2xs"
                title={`Restore "${notification.deletedRule.blueprint?.ruleName}" to RuleBook`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (notificationTimeoutRef.current) {
                  clearTimeout(notificationTimeoutRef.current);
                }
                setNotification(null);
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Auto-Category Filter Section */}
      {rules.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Search Box */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rule names, trigger keywords, exam traps, formulas..."
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:focus:border-amber-400 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Expand / Collapse All */}
            {filteredRules.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>

          {/* Auto-Category Filter Pills */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-amber-500 text-white shadow-xs font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All ({rules.length})
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-3 py-1 rounded-full font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCategory === cat.name
                      ? 'bg-amber-500 text-white shadow-xs font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className="text-[10px] opacity-80 px-1 py-0.2 bg-black/10 dark:bg-white/10 rounded-full">
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {rules.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 px-4 bg-slate-50/70 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-3.5 shadow-xs">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
            Your RuleBook is Empty
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mb-5 leading-relaxed">
            Your RuleBook is empty. Bookmark grammar rules during chat to save them here.
          </p>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Try asking: &quot;Find the error: She did not cope up with the stress&quot;</span>
          </div>
        </div>
      ) : filteredRules.length === 0 ? (
        /* No Match State */
        <div className="text-center py-12 px-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center">
          <Search className="w-8 h-8 text-slate-400 mb-2 opacity-60" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
            No matching rules found
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            No saved rules matched &ldquo;{searchQuery}&rdquo; in this category
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('ALL');
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset search and filters</span>
          </button>
        </div>
      ) : (
        /* Accordion List */
        <Accordion
          type="multiple"
          value={openAccordionValues}
          onValueChange={(val) => setOpenAccordionValues(Array.isArray(val) ? val : [val])}
        >
          {filteredRules.map((rule) => (
            <AccordionItem key={rule.id} value={rule.id}>
              {/* Trigger (Collapsed View) */}
              <AccordionTrigger
                actions={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRuleToDelete(rule);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    title={`Delete "${rule.blueprint?.ruleName || 'Rule'}" from RuleBook`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                }
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
                  <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                    {rule.blueprint?.ruleName}
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {rule.category && (
                      <Badge variant="secondary">
                        {rule.category}
                      </Badge>
                    )}

                    {rule.blueprint?.quickSwap && (
                      <span className="hidden lg:inline text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-xs">
                        {rule.blueprint.quickSwap}
                      </span>
                    )}
                  </div>
                </div>
              </AccordionTrigger>

              {/* Content (Expanded View) */}
              <AccordionContent>
                <RuleCard data={rule.blueprint} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Delete Confirmation Warning Modal */}
      {ruleToDelete &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setRuleToDelete(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      Delete Grammar Rule?
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      This action cannot be undone automatically.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRuleToDelete(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1.5">
                <p>
                  Are you sure you want to remove{' '}
                  <strong className="text-slate-900 dark:text-white font-bold">
                    &ldquo;{ruleToDelete.blueprint?.ruleName}&rdquo;
                  </strong>{' '}
                  from your RuleBook?
                </p>
                {ruleToDelete.category && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Category:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {ruleToDelete.category}
                    </span>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setRuleToDelete(null)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Rule</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
