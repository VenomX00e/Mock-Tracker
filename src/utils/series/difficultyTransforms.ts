import { SeriesPracticeLevel } from '../../types/seriesTypes';
import { DifficultyLevel } from '../../store/speedMathStore';
import { PatternDNA } from './patternParser';

export interface ExamDifficultyProfile {
  level: SeriesPracticeLevel;
  /**
   * 1 = consecutive (1², 2², 3² or 2, 3, 5, 7)
   * 2 = gapped / alternate skip (1², 3², 5² or 3, 7, 13, 19)
   */
  stride: 1 | 2;
  /**
   * 1 = ascending steps (+2², +3², +4²)
   * -1 = descending steps (+7², +6², +5²)
   */
  stepDirection: 1 | -1;
  /**
   * '+' = all steps add
   * '-' = all steps subtract
   * 'alternating' = +step1, -step2, +step3, -step4
   */
  signMode: '+' | '-' | 'alternating';
  /**
   * Camouflage delta applied to power/prime steps in Hard mode (e.g. -1 for p² - 1, +1 for n² + 1)
   */
  camouflageDelta: -1 | 0 | 1;
  /**
   * Effective evaluation mode ('term' vs 'step')
   * In L2/L3, a pure 'term' series (like 25, 49, 121) can be pushed 1 layer deeper into a 1st-difference 'step' series
   */
  effectiveEvalMode: 'term' | 'step';
  /**
   * Series length (5 or 6 terms) chosen to prevent 4-5 digit bloat on multipliers
   */
  seriesLength: 5 | 6;
  /**
   * Candidate indices for placing '?' in Missing Series
   */
  missingCandidateIndices: number[];
  /**
   * Candidate indices for corrupting a term in Wrong Series
   */
  wrongCandidateIndices: number[];
}

export function mapSpeedMathDifficultyToLevel(diff?: DifficultyLevel): SeriesPracticeLevel {
  switch (diff) {
    case 'BEGINNER':
    case 'EASY':
      return 1;
    case 'MEDIUM':
      return 2;
    case 'HARD':
    case 'CHALLENGING':
    case 'EXPERT':
      return 3;
    default:
      return 1;
  }
}

export function buildExamDifficultyProfile(
  dna: PatternDNA,
  level: SeriesPracticeLevel
): ExamDifficultyProfile {
  // Compact 3-Digit Guard: Use 5 terms for rapid-growth patterns (multipliers >= 3, cubes)
  const isRapidGrowth =
    (dna.multiplier !== undefined && dna.multiplier >= 3) ||
    dna.family === 'growing_mult_offset' ||
    dna.family === 'prime_cubes' ||
    dna.family === 'cubes';

  const seriesLength: 5 | 6 = isRapidGrowth ? 5 : 6;
  const lastIdx = seriesLength - 1;

  if (level === 1) {
    // Level 1 (Clerk Prelims / Easy):
    // Direct consecutive steps (stride 1), clean '+' sign, '?' near the end
    return {
      level: 1,
      stride: (dna.initialStride as 1 | 2) || 1,
      stepDirection: 1,
      signMode: dna.operationSign || '+',
      camouflageDelta: 0,
      effectiveEvalMode: dna.evaluationMode,
      seriesLength,
      missingCandidateIndices: [lastIdx - 1, lastIdx],
      wrongCandidateIndices: [2, 3, lastIdx - 1],
    };
  }

  if (level === 2) {
    // Level 2 (PO Prelims / Medium):
    // Gapping (stride 2: 1², 3², 5² or alternate primes), push 'term' series 1 layer deeper to 'step' difference,
    // and place '?' in the middle to hide two adjacent differences at once
    const effectiveEvalMode: 'term' | 'step' =
      dna.evaluationMode === 'term' ? 'step' : dna.evaluationMode;

    return {
      level: 2,
      stride: 2,
      stepDirection: 1,
      signMode: dna.operationSign || '+',
      camouflageDelta: 0,
      effectiveEvalMode,
      seriesLength,
      missingCandidateIndices: [2, 3],
      wrongCandidateIndices: [1, 2, 3],
    };
  }

  // Level 3 (PO Mains / Hard):
  // Uses alternating signs (+/-) or camouflaged offsets (n² ± 1) or descending steps,
  // and places '?' early (index 1 or 2) or corrupts early terms (index 0 or 1) in Wrong Series
  const useAlternating =
    dna.operationSign === 'alternating' ||
    (['squares', 'prime_squares', 'consecutive_primes', 'ap_difference'].includes(dna.family) &&
      Math.random() < 0.5);

  const useCamouflage =
    !useAlternating &&
    ['squares', 'cubes', 'prime_squares'].includes(dna.family) &&
    Math.random() < 0.65;

  const camouflageDelta: -1 | 0 | 1 = useCamouflage
    ? Math.random() < 0.5
      ? -1
      : 1
    : 0;

  const stepDirection: 1 | -1 =
    !useAlternating && !useCamouflage && ['squares', 'consecutive_primes', 'ap_difference'].includes(dna.family)
      ? -1
      : 1;

  return {
    level: 3,
    stride: 2,
    stepDirection,
    signMode: useAlternating ? 'alternating' : (dna.operationSign || '+'),
    camouflageDelta,
    effectiveEvalMode: 'step',
    seriesLength,
    missingCandidateIndices: [1, 2],
    wrongCandidateIndices: [0, 1, 2],
  };
}
