import { SeriesPattern, SeriesPracticeLevel, SeriesQuestion } from '../../types/seriesTypes';
import { OperationSettings } from '../../store/speedMathStore';
import { Question } from '../mathTypes';
import { BUILTIN_EXAM_PATTERNS } from './builtInPatterns';
import { parsePatternDescriptor } from './patternParser';
import { buildExamDifficultyProfile, mapSpeedMathDifficultyToLevel } from './difficultyTransforms';
import { generateMathematicalSequence } from './sequenceGenerators';

const VAULT_STORAGE_KEY = 'ypt_saved_series_patterns';

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Reads saved patterns from localStorage synchronously for zero-latency Speed Math question generation
 */
export function getSavedVaultPatternsSync(): SeriesPattern[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Resolves the active pool of patterns based on user's source preference ('VAULT' | 'BUILTIN' | 'BOTH')
 * Automatically falls back to BUILTIN_EXAM_PATTERNS if 'VAULT' is selected but the Vault is currently empty.
 */
export function resolvePatternPool(
  source: 'VAULT' | 'BUILTIN' | 'BOTH' = 'VAULT',
  categoryFilter?: string
): SeriesPattern[] {
  const saved = getSavedVaultPatternsSync();
  let pool: SeriesPattern[] = [];

  if (source === 'VAULT') {
    pool = saved.length > 0 ? saved : BUILTIN_EXAM_PATTERNS;
  } else if (source === 'BUILTIN') {
    pool = BUILTIN_EXAM_PATTERNS;
  } else {
    // BOTH: combine saved + built-in
    pool = [...saved, ...BUILTIN_EXAM_PATTERNS];
  }

  if (categoryFilter && categoryFilter !== 'all') {
    const filtered = pool.filter((p) => p.category === categoryFilter);
    if (filtered.length > 0) {
      return filtered;
    }
  }

  return pool.length > 0 ? pool : BUILTIN_EXAM_PATTERNS;
}

/**
 * Generates a single deterministic SeriesQuestion from a SeriesPattern and level (1, 2, or 3)
 */
export function generateSeriesQuestion(
  pattern: SeriesPattern,
  level: SeriesPracticeLevel,
  forcedType?: 'missing' | 'wrong'
): SeriesQuestion {
  const dna = parsePatternDescriptor(pattern);
  const profile = buildExamDifficultyProfile(dna, level);
  const { numbers, steps, hintText } = generateMathematicalSequence(dna, profile);

  const questionType: 'missing' | 'wrong' =
    forcedType || (level === 3 ? (Math.random() > 0.5 ? 'wrong' : 'missing') : 'missing');

  if (questionType === 'missing') {
    const validCandidates = profile.missingCandidateIndices.filter(
      (idx) => idx >= 0 && idx < numbers.length
    );
    const missingIndex =
      validCandidates.length > 0 ? getRandomItem(validCandidates) : numbers.length - 1;

    const correctAnswer = numbers[missingIndex];
    const displayNumbers: (number | string)[] = [...numbers];
    displayNumbers[missingIndex] = '?';

    return {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      patternId: pattern.id,
      patternTitle: pattern.title,
      type: 'missing',
      numbers: displayNumbers,
      correctAnswer,
      hintText,
      steps,
      level,
    };
  } else {
    // Wrong Number Series:
    // Perturb one term at a level-appropriate index so it breaks adjacent steps
    const validCandidates = profile.wrongCandidateIndices.filter(
      (idx) => idx >= 0 && idx < numbers.length
    );
    const culpritIndex =
      validCandidates.length > 0 ? getRandomItem(validCandidates) : 2;
    const originalValue = numbers[culpritIndex];

    const isDecimal = numbers.some((n) => n % 1 !== 0);
    const candidateOffsets = isDecimal
      ? [-2.5, -1.5, 1.5, 2.5, 5]
      : [-6, -4, -3, -2, 2, 3, 4, 6, 8];

    // Pick an offset that doesn't collide with any existing term in the sequence
    let corruptedValue = Number((originalValue + getRandomItem(candidateOffsets)).toFixed(4));
    for (const off of candidateOffsets) {
      const candidate = Number((originalValue + off).toFixed(4));
      if (candidate > 0 && !numbers.includes(candidate)) {
        corruptedValue = candidate;
        break;
      }
    }

    const displayNumbers: (number | string)[] = [...numbers];
    displayNumbers[culpritIndex] = corruptedValue;

    return {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      patternId: pattern.id,
      patternTitle: pattern.title,
      type: 'wrong',
      numbers: displayNumbers,
      correctAnswer: corruptedValue,
      culpritIndex,
      wrongReplacement: originalValue,
      hintText,
      steps,
      level,
    };
  }
}

/**
 * Speed Math Question Generator Adapter (`operation === 'series'`)
 * Integrates directly into `mathEngine.ts` and `MathArena.tsx`
 */
export function generateSeriesSpeedMathQuestion(
  settings?: OperationSettings
): Omit<Question, 'operation'> {
  const level = mapSpeedMathDifficultyToLevel(settings?.difficulty);
  const source = settings?.seriesSource || 'VAULT';
  const pool = resolvePatternPool(source, settings?.seriesCategory);
  const chosenPattern = getRandomItem(pool);

  // Determine whether this question is 'missing' or 'wrong'
  // Tile flip icon sets `isReverse: true` -> Wrong Series; `seriesMode` in gear settings can also be 'MIXED'
  let forcedType: 'missing' | 'wrong' = 'missing';
  if (settings?.seriesMode === 'MIXED') {
    forcedType = Math.random() < 0.5 ? 'missing' : 'wrong';
  } else if (settings?.seriesMode === 'WRONG' || settings?.isReverse) {
    forcedType = 'wrong';
  } else {
    forcedType = 'missing';
  }

  const sq = generateSeriesQuestion(chosenPattern, level, forcedType);
  const displayString = sq.numbers.join('   ');

  return {
    id: sq.id,
    num1: sq.correctAnswer,
    displayString,
    correctAnswer: sq.correctAnswer,
    seriesData: {
      type: sq.type,
      numbers: sq.numbers,
      steps: sq.steps,
      patternTitle: sq.patternTitle,
      patternCategory: chosenPattern.category || 'difference',
      culpritIndex: sq.culpritIndex,
      wrongReplacement: sq.wrongReplacement,
      hintText: sq.hintText,
    },
  };
}

/**
 * Generates 5 exam-grade distractor options (including same unit-digit traps)
 */
export function generateDistractorOptions(correctAnswer: number): number[] {
  const options = new Set<number>();
  options.add(correctAnswer);

  const isDecimal = correctAnswer % 1 !== 0;

  if (isDecimal) {
    const decimalDeltas = [-5, -2.5, -1.25, 1.25, 2.5, 5, 10, -0.5, 0.5];
    let attempts = 0;
    while (options.size < 5 && attempts < 50) {
      attempts++;
      const delta = getRandomItem(decimalDeltas);
      const candidate = Number((correctAnswer + delta).toFixed(4));
      if (candidate > 0 && candidate !== correctAnswer) {
        options.add(candidate);
      }
    }
    let counter = 1;
    while (options.size < 5) {
      options.add(Number((correctAnswer + counter * 2.5).toFixed(4)));
      counter++;
    }
  } else {
    // Include multiples of 10 (+10, -10, +20, -20) so 2-3 options share the exact same unit digit as the answer!
    const sameUnitDeltas = [-20, -10, 10, 20];
    const nearMissDeltas = [-6, -4, -2, -1, 1, 2, 4, 6, 8, 12];

    for (const d of sameUnitDeltas) {
      if (options.size >= 3) break;
      const cand = correctAnswer + d;
      if (cand > 0 && cand !== correctAnswer) {
        options.add(cand);
      }
    }

    let attempts = 0;
    while (options.size < 5 && attempts < 50) {
      attempts++;
      const delta = getRandomItem(nearMissDeltas);
      const candidate = correctAnswer + delta;
      if (candidate > 0 && candidate !== correctAnswer) {
        options.add(candidate);
      }
    }

    let counter = 1;
    while (options.size < 5) {
      options.add(correctAnswer + counter * 2);
      counter++;
    }
  }

  return Array.from(options).sort((a, b) => a - b);
}
