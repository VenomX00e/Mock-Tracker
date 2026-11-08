export type SeriesCategory = 
  | 'difference'       // AP, Double difference, Fibonacci
  | 'multiplication'   // × k + c, decimal ladders (×1.5, ×2.5)
  | 'powers'           // Squares, Cubes, n² ± k, n³ ± k
  | 'primes'           // Prime differences, prime offsets
  | 'alternating';     // Two intertwined series (+a, -b, +c...)

export interface SeriesPatternStep {
  text: string;        // e.g. "×2 + 5", "+ 3²", "+ 11"
}

export interface SeriesPattern {
  id: string;                    // Deterministic slug (e.g. "mult-2-primes")
  title: string;                 // e.g. "Multiply by 2 + Consecutive Primes"
  category: SeriesCategory;
  steps: string[];               // ["×2 + 5", "×2 + 7", "×2 + 11", "×2 + 13"]
  generatorKey: string;          // Identifier for math engine (e.g. "mul_const_primes")
  generatorParams?: Record<string, any>; // e.g. { multiplier: 2, primeStart: 5 }
  savedAt: number;
  userId?: string;
}

export type SeriesPracticeLevel = 1 | 2 | 3;

export interface SeriesQuestion {
  id: string;
  patternId: string;
  patternTitle: string;
  type: 'missing' | 'wrong';
  numbers: (number | string)[]; // e.g. [1, 7, 21, "?", 119, 255]
  correctAnswer: number;
  culpritIndex?: number;        // For wrong series (index of wrong number)
  steps: string[];              // ["×2 + 5", "×2 + 7", ...]
  level: SeriesPracticeLevel;
}
