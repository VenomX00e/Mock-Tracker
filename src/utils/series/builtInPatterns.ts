import { SeriesPattern } from '../../types/seriesTypes';

/**
 * Curated Built-in Banking & SSC Exam Archetypes Pack (IBPS PO/Clerk, SBI PO/Clerk, RBI, SSC CGL)
 * Used when "Built-in Exam Pack" or "Both (Saved + Built-in)" is selected in Speed Math settings,
 * or as an automatic fallback when the user's Pattern Vault is empty.
 */
export const BUILTIN_EXAM_PATTERNS: SeriesPattern[] = [
  // 1. Primes Family
  {
    id: 'builtin-prime-squares-term',
    title: 'Squares of Consecutive Primes',
    category: 'primes',
    steps: ['Square of 2', 'Square of 3', 'Square of 5', 'Square of 7', 'Square of 11'],
    generatorKey: 'prime_squares_term',
    generatorParams: {
      evaluationMode: 'term',
      family: 'prime_squares',
      powerExp: 2,
    },
    savedAt: 1700000001000,
  },
  {
    id: 'builtin-prime-squares-diff',
    title: 'Prime Square Differences (+p²)',
    category: 'primes',
    steps: ['+ 2²', '+ 3²', '+ 5²', '+ 7²', '+ 11²'],
    generatorKey: 'prime_squares_diff',
    generatorParams: {
      evaluationMode: 'step',
      family: 'prime_squares',
      powerExp: 2,
    },
    savedAt: 1700000002000,
  },
  {
    id: 'builtin-consecutive-primes-diff',
    title: 'Consecutive Prime Differences (+p)',
    category: 'primes',
    steps: ['+ 5', '+ 7', '+ 11', '+ 13', '+ 17'],
    generatorKey: 'consecutive_primes',
    generatorParams: {
      evaluationMode: 'step',
      family: 'consecutive_primes',
    },
    savedAt: 1700000003000,
  },
  {
    id: 'builtin-mult-2-add-primes',
    title: 'Multiply by 2 + Consecutive Primes',
    category: 'primes',
    steps: ['×2 + 2', '×2 + 3', '×2 + 5', '×2 + 7'],
    generatorKey: 'mult_variable_add',
    generatorParams: {
      evaluationMode: 'step',
      family: 'mult_variable_add',
      multiplier: 2,
      offsetType: 'primes',
    },
    savedAt: 1700000004000,
  },

  // 2. Multiplication Family
  {
    id: 'builtin-mult-2-add-3',
    title: 'Multiply by 2 and Add 3',
    category: 'multiplication',
    steps: ['×2 + 3', '×2 + 3', '×2 + 3', '×2 + 3'],
    generatorKey: 'mult_constant_add',
    generatorParams: {
      evaluationMode: 'step',
      family: 'mult_constant_add',
      multiplier: 2,
      constantAdd: 3,
    },
    savedAt: 1700000005000,
  },
  {
    id: 'builtin-mult-3-sub-2',
    title: 'Multiply by 3 and Subtract 2',
    category: 'multiplication',
    steps: ['×3 - 2', '×3 - 2', '×3 - 2', '×3 - 2'],
    generatorKey: 'mult_constant_add',
    generatorParams: {
      evaluationMode: 'step',
      family: 'mult_constant_add',
      multiplier: 3,
      constantAdd: -2,
    },
    savedAt: 1700000006000,
  },
  {
    id: 'builtin-mult-2-5',
    title: 'Multiply by 2.5 (Decimal Multiplier)',
    category: 'multiplication',
    steps: ['×2.5', '×2.5', '×2.5', '×2.5'],
    generatorKey: 'constant_multiplier',
    generatorParams: {
      evaluationMode: 'step',
      family: 'constant_multiplier',
      multiplier: 2.5,
    },
    savedAt: 1700000007000,
  },
  {
    id: 'builtin-mult-1-5',
    title: 'Multiply by 1.5 (3/2 Ratio)',
    category: 'multiplication',
    steps: ['×1.5', '×1.5', '×1.5', '×1.5'],
    generatorKey: 'constant_multiplier',
    generatorParams: {
      evaluationMode: 'step',
      family: 'constant_multiplier',
      multiplier: 1.5,
    },
    savedAt: 1700000008000,
  },
  {
    id: 'builtin-decimal-half-ladder',
    title: 'Half-Step Decimal Ladder (×0.5, ×1, ×1.5, ×2)',
    category: 'multiplication',
    steps: ['×0.5', '×1', '×1.5', '×2', '×2.5'],
    generatorKey: 'decimal_ladder',
    generatorParams: {
      evaluationMode: 'step',
      family: 'decimal_ladder',
      multStart: 0.5,
      multStep: 0.5,
    },
    savedAt: 1700000009000,
  },
  {
    id: 'builtin-growing-mult-plus-n',
    title: 'Sequential Multiplier + Index (×1+1, ×2+2, ×3+3)',
    category: 'multiplication',
    steps: ['×1 + 1', '×2 + 2', '×3 + 3', '×4 + 4'],
    generatorKey: 'growing_mult_offset',
    generatorParams: {
      evaluationMode: 'step',
      family: 'growing_mult_offset',
    },
    savedAt: 1700000010000,
  },

  // 3. Powers / Squares / Cubes Family
  {
    id: 'builtin-consecutive-squares-diff',
    title: 'Consecutive Square Differences (+n²)',
    category: 'powers',
    steps: ['+ 2²', '+ 3²', '+ 4²', '+ 5²', '+ 6²'],
    generatorKey: 'squares_diff',
    generatorParams: {
      evaluationMode: 'step',
      family: 'squares',
      powerExp: 2,
    },
    savedAt: 1700000011000,
  },
  {
    id: 'builtin-consecutive-cubes-diff',
    title: 'Consecutive Cube Differences (+n³)',
    category: 'powers',
    steps: ['+ 1³', '+ 2³', '+ 3³', '+ 4³'],
    generatorKey: 'cubes_diff',
    generatorParams: {
      evaluationMode: 'step',
      family: 'cubes',
      powerExp: 3,
    },
    savedAt: 1700000012000,
  },
  {
    id: 'builtin-n-square-plus-n-diff',
    title: 'n² + n Differences (+6, +12, +20, +30)',
    category: 'powers',
    steps: ['+ (2²+2)', '+ (3²+3)', '+ (4²+4)', '+ (5²+5)'],
    generatorKey: 'n_power_offset_diff',
    generatorParams: {
      evaluationMode: 'step',
      family: 'n_power_offset',
      powerExp: 2,
      selfOffset: 1,
    },
    savedAt: 1700000013000,
  },
  {
    id: 'builtin-n-cube-minus-n-diff',
    title: 'n³ - n Differences (+6, +24, +60, +120)',
    category: 'powers',
    steps: ['+ (2³-2)', '+ (3³-3)', '+ (4³-4)', '+ (5³-5)'],
    generatorKey: 'n_cube_minus_n',
    generatorParams: {
      evaluationMode: 'step',
      family: 'n_power_offset',
      powerExp: 3,
      selfOffset: -1,
    },
    savedAt: 1700000014000,
  },

  // 4. Differences Family
  {
    id: 'builtin-ap-multiples-diff',
    title: 'Arithmetic Table Differences (+12, +24, +36, +48)',
    category: 'difference',
    steps: ['+ 12', '+ 24', '+ 36', '+ 48', '+ 60'],
    generatorKey: 'ap_difference',
    generatorParams: {
      evaluationMode: 'step',
      family: 'ap_difference',
      diffStep: 12,
    },
    savedAt: 1700000015000,
  },
  {
    id: 'builtin-double-difference-ap',
    title: 'Double Difference Progression (2nd-Layer AP)',
    category: 'difference',
    steps: ['+ 8', '+ 18', '+ 32', '+ 50', '+ 72'],
    generatorKey: 'double_difference',
    generatorParams: {
      evaluationMode: 'step',
      family: 'double_difference',
    },
    savedAt: 1700000016000,
  },

  // 5. Alternating Family
  {
    id: 'builtin-alternating-squares',
    title: 'Alternating Square Steps (+n², -n²)',
    category: 'alternating',
    steps: ['+ 3²', '- 4²', '+ 5²', '- 6²', '+ 7²'],
    generatorKey: 'alternating_squares',
    generatorParams: {
      evaluationMode: 'step',
      family: 'squares',
      signRule: 'alternating',
    },
    savedAt: 1700000017000,
  },
  {
    id: 'builtin-alternating-ap',
    title: 'Alternating Addition & Subtraction (+15, -30, +45, -60)',
    category: 'alternating',
    steps: ['+ 15', '- 30', '+ 45', '- 60', '+ 75'],
    generatorKey: 'alternating_ap',
    generatorParams: {
      evaluationMode: 'step',
      family: 'ap_difference',
      diffStep: 15,
      signRule: 'alternating',
    },
    savedAt: 1700000018000,
  },
];
