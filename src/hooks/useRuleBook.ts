import { useState, useEffect, useCallback } from 'react';

export interface GrammarBlueprintFormula {
  text: string;
  isValid: boolean;
}

export type GrammarCategory = 
  | "Subject-Verb Agreement" 
  | "Verb Tenses & Conditionals" 
  | "Pronoun Reference & Agreement" 
  | "Modifiers (Misplaced & Dangling)" 
  | "Parallelism & Structure" 
  | "Prepositions & Idioms" 
  | "Nouns & Articles" 
  | "Conjunctions & Clauses" 
  | "Word Choice & Redundancy" 
  | "General Grammar";

export interface GrammarBlueprint {
  ruleName: string;
  category: GrammarCategory;
  originalSentenceBreakdown: {
    prefix: string;
    errorText: string;
    correctText: string;
    suffix: string;
    fixReason?: string;
  };
  quickSwap?: string;
  spottingStrategy: string;
  formulas?: GrammarBlueprintFormula[];
  example?: {
    incorrect?: string;
    correct?: string;
  };
}

export interface SavedRule {
  id: string;
  savedAt: number;
  category: string;
  blueprint: GrammarBlueprint;
}

const STORAGE_KEY = 'rulebook_data';
const SYNC_EVENT = 'rulebook-updated';

/**
 * Extracts a concise category tag from a rule name.
 * e.g., "Idiomatic Usage (Cope with)" -> "Idiomatic Usage"
 * e.g., "Quantifier-Noun Agreement (\"Most + Plural Countable Noun\")" -> "Quantifier-Noun Agreement"
 * e.g., "Conditionals: Inverted Third Conditional" -> "Conditionals"
 * e.g., "Subject-Verb Agreement - Collective Nouns" -> "Subject-Verb Agreement"
 */
export function extractCategory(ruleName: string): string {
  if (!ruleName || typeof ruleName !== 'string') return 'General Grammar';
  
  const trimmed = ruleName.trim();
  
  // Look for separators: (, :, -, /
  const match = trimmed.match(/^([^(:\\-\\/"]+)/);
  if (match && match[1]) {
    const candidate = match[1].trim();
    if (candidate.length >= 3 && candidate.length <= 35) {
      return candidate;
    }
  }

  // Fallback: If short enough, use as is; otherwise default to General Grammar
  if (trimmed.length <= 30) {
    return trimmed;
  }
  return 'General Grammar';
}

function getStoredRules(): SavedRule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.error('[useRuleBook] Failed to read from localStorage:', err);
    return [];
  }
}

function setStoredRules(rules: SavedRule[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
    return true;
  } catch (err: any) {
    // QuotaExceededError or security policy errors
    if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014) {
      console.error('[useRuleBook] localStorage quota exceeded:', err);
    } else {
      console.error('[useRuleBook] Failed to write to localStorage:', err);
    }
    return false;
  }
}

export function useRuleBook() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [rules, setRules] = useState<SavedRule[]>(() => {
    if (typeof window !== 'undefined') {
      return getStoredRules();
    }
    return [];
  });

  // Ensure hydration-safe initial read on mount and keep state synchronized
  useEffect(() => {
    setIsHydrated(true);
    setRules(getStoredRules());

    const handleSync = () => {
      setRules(getStoredRules());
    };

    window.addEventListener(SYNC_EVENT, handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener(SYNC_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  /**
   * Check if a rule is already saved by rule name
   */
  const isRuleSaved = useCallback(
    (ruleName?: string): boolean => {
      if (!ruleName) return false;
      const normalized = ruleName.trim().toLowerCase();
      return rules.some(
        (r) => r.blueprint?.ruleName && r.blueprint.ruleName.trim().toLowerCase() === normalized
      );
    },
    [rules]
  );

  /**
   * Get a saved rule by rule name
   */
  const getSavedRule = useCallback(
    (ruleName?: string): SavedRule | undefined => {
      if (!ruleName) return undefined;
      const normalized = ruleName.trim().toLowerCase();
      return rules.find(
        (r) => r.blueprint?.ruleName && r.blueprint.ruleName.trim().toLowerCase() === normalized
      );
    },
    [rules]
  );

  /**
   * Save a rule blueprint to the RuleBook
   */
  const saveRule = useCallback(
    (blueprint: GrammarBlueprint): { success: boolean; isDuplicate?: boolean; message: string; rule?: SavedRule } => {
      if (!blueprint || !blueprint.ruleName) {
        return { success: false, message: 'Invalid rule blueprint' };
      }

      const current = getStoredRules();
      const normalizedName = blueprint.ruleName.trim().toLowerCase();

      // Deduplication check
      const existing = current.find(
        (r) => r.blueprint?.ruleName && r.blueprint.ruleName.trim().toLowerCase() === normalizedName
      );

      if (existing) {
        return {
          success: false,
          isDuplicate: true,
          message: 'Rule already saved in your RuleBook',
          rule: existing,
        };
      }

      const newRule: SavedRule = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        savedAt: Date.now(),
        category: blueprint.category || extractCategory(blueprint.ruleName),
        blueprint: {
          ruleName: blueprint.ruleName.trim(),
          formulas: Array.isArray(blueprint.formulas)
            ? blueprint.formulas.map((f) => ({ text: f.text || '', isValid: !!f.isValid }))
            : [],
          category: (blueprint.category || extractCategory(blueprint.ruleName)) as GrammarCategory,
          originalSentenceBreakdown: blueprint.originalSentenceBreakdown,
          quickSwap: blueprint.quickSwap,
          spottingStrategy: blueprint.spottingStrategy || '',
          example: blueprint.example
            ? {
                incorrect: blueprint.example.incorrect || '',
                correct: blueprint.example.correct || '',
              }
            : undefined,
        },
      };

      const updated = [newRule, ...current];
      const writeOk = setStoredRules(updated);
      if (!writeOk) {
        return {
          success: false,
          message: 'Storage quota exceeded. Please export and clean up older rules.',
        };
      }
      setRules(updated);

      return {
        success: true,
        message: 'Saved to RuleBook',
        rule: newRule,
      };
    },
    []
  );

  /**
   * Remove a rule by its ID or rule name
   */
  const removeRule = useCallback(
    (idOrRuleName: string): { success: boolean; message: string } => {
      if (!idOrRuleName) return { success: false, message: 'Identifier required' };

      const current = getStoredRules();
      const normalizedTarget = idOrRuleName.trim().toLowerCase();

      const updated = current.filter(
        (r) => r.id !== idOrRuleName && r.blueprint?.ruleName?.trim().toLowerCase() !== normalizedTarget
      );

      if (updated.length === current.length) {
        return { success: false, message: 'Rule not found' };
      }

      setStoredRules(updated);
      setRules(updated);

      return { success: true, message: 'Rule removed from RuleBook' };
    },
    []
  );

  /**
   * Restore a previously deleted rule
   */
  const restoreRule = useCallback(
    (rule: SavedRule): { success: boolean; message: string } => {
      if (!rule || !rule.blueprint?.ruleName) {
        return { success: false, message: 'Invalid rule object' };
      }

      const current = getStoredRules();
      const normalizedTarget = rule.blueprint.ruleName.trim().toLowerCase();

      // Check if already in rules
      const exists = current.some(
        (r) => r.id === rule.id || r.blueprint?.ruleName?.trim().toLowerCase() === normalizedTarget
      );

      if (exists) {
        return { success: true, message: 'Rule already present in RuleBook' };
      }

      const updated = [rule, ...current];
      const ok = setStoredRules(updated);
      if (!ok) {
        return { success: false, message: 'Failed to restore: storage limit exceeded' };
      }
      setRules(updated);
      return { success: true, message: 'Rule restored to RuleBook' };
    },
    []
  );

  /**
   * Toggle save state for a blueprint
   */
  const toggleSaveRule = useCallback(
    (blueprint: GrammarBlueprint): { saved: boolean; message: string } => {
      if (!blueprint?.ruleName) return { saved: false, message: 'Invalid rule blueprint' };

      if (isRuleSaved(blueprint.ruleName)) {
        removeRule(blueprint.ruleName);
        return { saved: false, message: 'Removed from RuleBook' };
      } else {
        const result = saveRule(blueprint);
        return { saved: result.success, message: result.message };
      }
    },
    [isRuleSaved, removeRule, saveRule]
  );

  /**
   * Clear all saved rules
   */
  const clearAllRules = useCallback((): void => {
    setStoredRules([]);
    setRules([]);
  }, []);

  /**
   * Export all rules as a JSON string
   */
  const exportRules = useCallback((): string => {
    const current = getStoredRules();
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        totalRules: current.length,
        rules: current,
      },
      null,
      2
    );
  }, []);

  /**
   * Download all rules as a JSON backup file
   */
  const exportRulesAsFile = useCallback((filename = 'rulebook_backup.json'): void => {
    const dataStr = exportRules();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [exportRules]);

  /**
   * Import rules from a JSON string or array, merging and deduplicating
   */
  const importRules = useCallback(
    (jsonData: string | SavedRule[]): { success: boolean; count: number; message: string } => {
      try {
        let importedList: any[] = [];
        if (typeof jsonData === 'string') {
          const parsed = JSON.parse(jsonData);
          importedList = Array.isArray(parsed) ? parsed : parsed.rules || [];
        } else if (Array.isArray(jsonData)) {
          importedList = jsonData;
        }

        if (!Array.isArray(importedList) || importedList.length === 0) {
          return { success: false, count: 0, message: 'No valid rules found in backup data' };
        }

        const current = getStoredRules();
        const existingNames = new Set(current.map((r) => r.blueprint?.ruleName?.trim().toLowerCase()));

        let addedCount = 0;
        const validNewRules: SavedRule[] = [];

        for (const item of importedList) {
          const blueprint: GrammarBlueprint = item.blueprint || item;
          if (blueprint && blueprint.ruleName) {
            const norm = blueprint.ruleName.trim().toLowerCase();
            if (!existingNames.has(norm)) {
              existingNames.add(norm);
              validNewRules.push({
                id: item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`),
                savedAt: item.savedAt || Date.now(),
                category: item.category || blueprint.category || extractCategory(blueprint.ruleName),
                blueprint: {
                  ruleName: blueprint.ruleName.trim(),
                  formulas: Array.isArray(blueprint.formulas)
                    ? blueprint.formulas.map((f) => ({ text: f.text || '', isValid: !!f.isValid }))
                    : [],
                  category: (blueprint.category || extractCategory(blueprint.ruleName)) as GrammarCategory,
                  originalSentenceBreakdown: blueprint.originalSentenceBreakdown,
                  quickSwap: blueprint.quickSwap,
                  spottingStrategy: blueprint.spottingStrategy || '',
                  example: blueprint.example
                    ? {
                        incorrect: blueprint.example.incorrect || '',
                        correct: blueprint.example.correct || '',
                      }
                    : undefined,
                },
              });
              addedCount++;
            }
          }
        }

        const updated = [...validNewRules, ...current];
        setStoredRules(updated);
        setRules(updated);

        return {
          success: true,
          count: addedCount,
          message: addedCount > 0 ? `Successfully imported ${addedCount} new rule(s)` : 'All imported rules were already in your RuleBook',
        };
      } catch (err) {
        console.error('[useRuleBook] Import failed:', err);
        return { success: false, count: 0, message: 'Failed to parse import file. Please ensure it is a valid JSON file.' };
      }
    },
    []
  );

  return {
    rules,
    isHydrated,
    isRuleSaved,
    getSavedRule,
    saveRule,
    removeRule,
    restoreRule,
    toggleSaveRule,
    clearAllRules,
    exportRules,
    exportRulesAsFile,
    importRules,
  };
}
