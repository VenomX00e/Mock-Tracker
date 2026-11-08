import { SeriesPattern, SeriesPracticeLevel, SeriesQuestion, SeriesCategory } from '../types/seriesTypes';

// Precomputed prime table for prime-difference ladders
const PRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97
];

export interface PatternDNA {
  family: 
    | 'prime_squares'      // + p² (+4, +9, +25, +49)
    | 'prime_cubes'        // + p³ (+8, +27, +125)
    | 'consecutive_primes' // + p (+2, +3, +5, +7)
    | 'squares'            // + n² (+1, +4, +9) or odd squares (+9, +25, +49)
    | 'cubes'              // + n³ (+1, +8, +27)
    | 'constant_multiplier' // × M on every step (e.g. ×2.5, ×2.5, ×2.5)
    | 'mult_constant_add'  // × M + C (e.g. ×5 + 2, ×5 + 2, ×5 + 2)
    | 'mult_variable_add'  // × M + (growing: odds, naturals, primes)
    | 'decimal_ladder'     // × 0.5, × 1.0, × 1.5, × 2.0 (different multipliers across steps)
    | 'double_difference'  // + d1, + d2 where diffs form an AP/GP
    | 'ap_difference';     // + 7, + 14, + 21
  multiplier?: number;     // e.g. 2.5 or 5
  constantAdd?: number;    // e.g. 2
  operationSign?: '+' | '-';
  stepDeltas?: number[];
}

/**
 * Robust introspector that extracts the exact mathematical DNA
 * from pattern.title, pattern.steps, and pattern.generatorParams
 */
export function parsePatternDescriptor(pattern: SeriesPattern): PatternDNA {
  const title = (pattern.title || '').toLowerCase();
  const steps = (pattern.steps || []).map(s => s.trim());
  const stepsJoined = steps.join(' ').toLowerCase();
  const key = (pattern.generatorKey || '').toLowerCase();

  // 1. Prime Squares Detection
  // e.g. "Squares of Consecutive Primes", steps: ["Square of 5", "Square of 7"] or ["+ 5²", "+ 7²"]
  const hasSquareWord = title.includes('square') || stepsJoined.includes('square') || stepsJoined.includes('²') || stepsJoined.includes('^2');
  const hasCubeWord = title.includes('cube') || stepsJoined.includes('cube') || stepsJoined.includes('³') || stepsJoined.includes('^3');
  const hasPrimeWord = pattern.category === 'primes' || title.includes('prime') || key.includes('prime') || stepsJoined.includes('prime');

  if (hasPrimeWord && hasSquareWord) {
    return { family: 'prime_squares' };
  }
  if (hasPrimeWord && hasCubeWord) {
    return { family: 'prime_cubes' };
  }

  // 2. Pure Constant Multiplier Detection without add/sub
  // Matches steps like: ["×2.5", "×2.5", "×2.5", "×2.5"] or ["× 2.5", "× 2.5"] or ["*2.5"]
  const pureMultRegex = /^(?:×|\*|x)\s*(\d+(?:\.\d+)?)$/i;
  const parsedPureMultSteps = steps.map(s => {
    const match = s.match(pureMultRegex);
    return match ? parseFloat(match[1]) : null;
  });

  if (parsedPureMultSteps.length > 0 && parsedPureMultSteps.every(m => m !== null)) {
    const firstMult = parsedPureMultSteps[0] as number;
    const allSame = parsedPureMultSteps.every(m => m === firstMult);
    if (allSame) {
      return {
        family: 'constant_multiplier',
        multiplier: firstMult,
      };
    } else {
      // Step multipliers actually change across steps (e.g. ×1, ×1.5, ×2, ×2.5)
      return {
        family: 'decimal_ladder'
      };
    }
  }

  // 3. Multiplication + Addition Detection (inspecting ×M + C patterns)
  // Handles formats like: "×5 + 2", "*5 + 2", "x5 + 2", "× 5 + 2", "Multiply by 5 and Add 2"
  const multRegex = /(?:×|\*|x)\s*(\d+(?:\.\d+)?)\s*([+\-])\s*(\d+)/i;
  const parsedMultSteps = steps.map(s => {
    const match = s.match(multRegex);
    if (match) {
      return {
        multiplier: parseFloat(match[1]),
        sign: match[2] as '+' | '-',
        addVal: parseInt(match[3], 10)
      };
    }
    return null;
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  if (parsedMultSteps.length > 0) {
    const first = parsedMultSteps[0];
    const allSameMultiplier = parsedMultSteps.every(p => p.multiplier === first.multiplier);
    const allSameAdd = parsedMultSteps.every(p => p.addVal === first.addVal && p.sign === first.sign);

    if (allSameMultiplier && allSameAdd) {
      // Constant Multiplier + Constant Offset (e.g. ×5 + 2)
      return {
        family: 'mult_constant_add',
        multiplier: first.multiplier,
        constantAdd: first.sign === '-' ? -first.addVal : first.addVal,
        operationSign: first.sign
      };
    }

    if (allSameMultiplier && !allSameAdd) {
      // Constant Multiplier + Variable Offset (e.g. ×2 + 1, ×2 + 3, ×2 + 5)
      return {
        family: 'mult_variable_add',
        multiplier: first.multiplier,
        stepDeltas: parsedMultSteps.map(p => p.sign === '-' ? -p.addVal : p.addVal)
      };
    }
  }

  // Check Title-based fallback for multiplication
  // e.g. "Multiply by 5 and Add 2"
  const titleMultAddMatch = title.match(/multiply by (\d+(?:\.\d+)?)\s*(?:and\s*)?([+\-]|add|subtract)\s*(\d+)/i);
  if (titleMultAddMatch) {
    const mult = parseFloat(titleMultAddMatch[1]);
    const isSub = titleMultAddMatch[2].includes('-') || titleMultAddMatch[2].includes('sub');
    const val = parseInt(titleMultAddMatch[3], 10);
    return {
      family: 'mult_constant_add',
      multiplier: mult,
      constantAdd: isSub ? -val : val,
      operationSign: isSub ? '-' : '+'
    };
  }

  // Check Title-based fallback for pure multiplication: "Multiply by 2.5"
  const titlePureMultMatch = title.match(/multiply by (\d+(?:\.\d+)?)/i);
  if (titlePureMultMatch) {
    const mult = parseFloat(titlePureMultMatch[1]);
    return {
      family: 'constant_multiplier',
      multiplier: mult
    };
  }

  // 4. Decimal Ladder ONLY if steps specifically exhibit changing multipliers (e.g. ×0.5 then ×1 then ×1.5)
  if (steps.some(s => s.includes('0.5')) && steps.some(s => s.includes('1.5'))) {
    return { family: 'decimal_ladder' };
  }

  // 5. Consecutive Primes (raw primes without powers)
  if (hasPrimeWord) {
    return { family: 'consecutive_primes' };
  }

  // 6. Normal Powers (Squares & Cubes without primes)
  if (hasCubeWord) {
    return { family: 'cubes' };
  }
  if (hasSquareWord) {
    return { family: 'squares' };
  }

  // 7. Double Difference
  if (title.includes('double') || key.includes('double')) {
    return { family: 'double_difference' };
  }

  return { family: 'ap_difference' };
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface StepSequenceResult {
  numbers: number[];
  steps: string[];
}

/**
 * Core mathematical rule generators
 */
function generatePrimeStepSeries(
  pattern: SeriesPattern,
  level: SeriesPracticeLevel,
  length = 6
): StepSequenceResult {
  let startIndex = 0;
  let stride = 1;
  let baseMultiplier = 1;
  let startBase = 5;

  if (pattern.steps?.some(s => s.includes('×') || s.includes('*'))) {
    baseMultiplier = pattern.generatorParams?.multiplier || 2;
  }

  if (level === 1) {
    // Level 1: Low base (1–10), initial primes [2, 3, 5, 7, 11]
    startBase = getRandomInt(1, 10);
    startIndex = 0; // starts at 2 or 3
    stride = 1;
  } else if (level === 2) {
    // Level 2: Medium base (15–60), mid primes [11, 13, 17, 19]
    startBase = getRandomInt(15, 60);
    startIndex = getRandomInt(4, 7); // starts around 11 to 19
    stride = 1;
  } else {
    // Level 3: Higher base (50–150), alternate prime skips [5, 11, 17, 23]
    startBase = getRandomInt(50, 150);
    startIndex = getRandomInt(2, 6);
    stride = 2; // skip one prime
  }

  const numbers: number[] = [startBase];
  const steps: string[] = [];

  for (let i = 0; i < length - 1; i++) {
    const primeVal = PRIMES[startIndex + i * stride] || (PRIMES[PRIMES.length - 1] + i * 2);
    const prev = numbers[numbers.length - 1];
    
    let next: number;
    let stepLabel: string;

    if (baseMultiplier > 1) {
      next = prev * baseMultiplier + primeVal;
      stepLabel = `×${baseMultiplier} + ${primeVal}`;
    } else {
      next = prev + primeVal;
      stepLabel = `+ ${primeVal}`;
    }

    numbers.push(next);
    steps.push(stepLabel);
  }

  return { numbers, steps };
}

function generatePowerStepSeries(
  pattern: SeriesPattern,
  level: SeriesPracticeLevel,
  length = 6
): StepSequenceResult {
  const isCube = pattern.title?.toLowerCase().includes('cube') || 
                 pattern.steps?.some(s => s.includes('³') || s.includes('^3'));

  let startBase = 10;
  let stepStart = 2;
  let stride = 1;

  if (level === 1) {
    // Level 1: Low base (2–15), small consecutive squares/cubes (1², 2², 3²)
    startBase = getRandomInt(2, 15);
    stepStart = isCube ? 1 : 2;
    stride = 1;
  } else if (level === 2) {
    // Level 2: Mid base (20–80), higher consecutive bases (7², 8², 9² or 4³, 5³, 6³)
    startBase = getRandomInt(20, 80);
    stepStart = isCube ? 4 : getRandomInt(6, 11);
    stride = 1;
  } else {
    // Level 3: Higher base (50–200), alternate skips (odd squares 3², 5², 7² or alternating +/-)
    startBase = getRandomInt(50, 200);
    stepStart = isCube ? 3 : 3;
    stride = 2; // skip 1 (odd or even squares)
  }

  const numbers: number[] = [startBase];
  const steps: string[] = [];

  for (let i = 0; i < length - 1; i++) {
    const baseVal = stepStart + i * stride;
    const powerVal = isCube ? Math.pow(baseVal, 3) : Math.pow(baseVal, 2);
    const prev = numbers[numbers.length - 1];
    const next = prev + powerVal;

    numbers.push(next);
    steps.push(`+ ${baseVal}${isCube ? '³' : '²'} (${powerVal})`);
  }

  return { numbers, steps };
}

function generateMultiplicationSeries(
  pattern: SeriesPattern,
  level: SeriesPracticeLevel,
  length = 6
): StepSequenceResult {
  let startBase = 4;
  let multiplier = 2;
  let addStep = 1;

  if (pattern.steps?.some(s => s.includes('1.5') || s.includes('2.5') || s.includes('0.5'))) {
    // Decimal ladder (e.g. × 0.5, × 1, × 1.5, × 2 or × 1.5, × 2.5)
    let multStart = level === 1 ? 1 : level === 2 ? 0.5 : 1.5;
    startBase = level === 1 ? getRandomInt(8, 20) * 2 : getRandomInt(12, 30) * 4;
    const numbers: number[] = [startBase];
    const steps: string[] = [];

    for (let i = 0; i < length - 1; i++) {
      const currentMult = multStart + i * 0.5;
      const prev = numbers[numbers.length - 1];
      const next = Math.round(prev * currentMult);
      numbers.push(next);
      steps.push(`× ${currentMult}`);
    }
    return { numbers, steps };
  }

  if (level === 1) {
    // Level 1: Low base (1–8), clean multiplier + small constant
    startBase = getRandomInt(1, 8);
    multiplier = 2;
    addStep = 1;
  } else if (level === 2) {
    // Level 2: Mid base (12–40), multiplier + growing odd numbers (+1, +3, +5, +7)
    startBase = getRandomInt(12, 40);
    multiplier = 2;
    addStep = 3;
  } else {
    // Level 3: Higher base (30–90), ×3 + odds or alternate + / -
    startBase = getRandomInt(30, 90);
    multiplier = 2;
    addStep = 5;
  }

  const numbers: number[] = [startBase];
  const steps: string[] = [];

  for (let i = 0; i < length - 1; i++) {
    const prev = numbers[numbers.length - 1];
    const offset = addStep + i * 2;
    const next = prev * multiplier + offset;
    numbers.push(next);
    steps.push(`×${multiplier} + ${offset}`);
  }

  return { numbers, steps };
}

function generateDifferenceSeries(
  pattern: SeriesPattern,
  level: SeriesPracticeLevel,
  length = 6
): StepSequenceResult {
  let startBase = 10;
  let diffStart = 7;
  let diffInc = 7;

  if (level === 1) {
    // Level 1: Simple AP (e.g. +7, +14, +21 or +6, +12, +18)
    startBase = getRandomInt(5, 25);
    diffInc = getRandomItem([4, 6, 7, 8, 9]);
    diffStart = diffInc;
  } else if (level === 2) {
    // Level 2: Double difference (e.g. +6, +14, +30, +62 where diff of diff doubles)
    startBase = getRandomInt(20, 75);
    const numbers = [startBase];
    const steps: string[] = [];
    let curDiff = getRandomItem([6, 8, 10]);
    for (let i = 0; i < length - 1; i++) {
      const prev = numbers[numbers.length - 1];
      const next = prev + curDiff;
      numbers.push(next);
      steps.push(`+ ${curDiff}`);
      curDiff = curDiff * 2 + 2; // double difference expansion
    }
    return { numbers, steps };
  } else {
    // Level 3: Alternating addition and subtraction (+24, -18, +32, -22)
    startBase = getRandomInt(100, 250);
    const numbers = [startBase];
    const steps: string[] = [];
    let addVal = 25;
    let subVal = 15;
    for (let i = 0; i < length - 1; i++) {
      const prev = numbers[numbers.length - 1];
      const isAdd = i % 2 === 0;
      const stepVal = isAdd ? addVal : subVal;
      const next = isAdd ? prev + stepVal : prev - stepVal;
      numbers.push(next);
      steps.push(isAdd ? `+ ${stepVal}` : `- ${stepVal}`);
      if (isAdd) addVal += 5;
      else subVal += 5;
    }
    return { numbers, steps };
  }

  const numbers: number[] = [startBase];
  const steps: string[] = [];
  for (let i = 0; i < length - 1; i++) {
    const curDiff = diffStart + i * diffInc;
    const prev = numbers[numbers.length - 1];
    numbers.push(prev + curDiff);
    steps.push(`+ ${curDiff}`);
  }
  return { numbers, steps };
}

/**
 * 2.1 Dedicated Generator for Prime Squares (+ p²):
 * e.g. "Squares of Consecutive Primes"
 * Level 1: Low base (2–10), initial primes [2, 3, 5, 7] -> +4, +9, +25, +49
 * Level 2: Mid base (20–60), mid primes [5, 7, 11, 13] -> +25, +49, +121, +169
 * Level 3: High base (50–150), skips [3, 7, 13, 19] or higher primes [11, 13, 17, 19]
 */
function generatePrimeSquareSeries(
  level: SeriesPracticeLevel,
  isCube = false,
  length = 6
): StepSequenceResult {
  let startBase = 5;
  let startIndex = 0;
  let stride = 1;

  if (level === 1) {
    // Level 1: Base (2–10), starting primes 2, 3, 5, 7
    startBase = getRandomInt(2, 10);
    startIndex = 0; // Primes: 2, 3, 5, 7, 11
    stride = 1;
  } else if (level === 2) {
    // Level 2: Base (20–60), starting primes 5, 7, 11, 13
    startBase = getRandomInt(20, 60);
    startIndex = 2; // Index 2 in PRIMES is 5 -> [5, 7, 11, 13, 17]
    stride = 1;
  } else {
    // Level 3: Base (50–150), higher primes or alternating skips [3, 7, 13, 19]
    startBase = getRandomInt(50, 150);
    startIndex = getRandomItem([1, 4]); // 3 or 11
    stride = 2; // skip one prime
  }

  const numbers: number[] = [startBase];
  const steps: string[] = [];

  for (let i = 0; i < length - 1; i++) {
    const p = PRIMES[startIndex + i * stride] || (PRIMES[PRIMES.length - 1] + (i * 2 + 1));
    const delta = isCube ? Math.pow(p, 3) : Math.pow(p, 2);
    const prev = numbers[numbers.length - 1];
    const next = prev + delta;

    numbers.push(next);
    steps.push(`+ ${p}${isCube ? '³' : '²'} (${delta})`);
  }

  return { numbers, steps };
}

/**
 * 2.2 Dedicated Generator for Constant Multiplier + Constant Offset (× M + C):
 * e.g. "Multiply by 5 and Add 2" -> T(n) = T(n-1) * 5 + 2
 * Preserves the EXACT multiplier and addition from the saved card!
 */
function generateConstantMultAddSeries(
  multiplier: number,
  constantAdd: number,
  level: SeriesPracticeLevel,
  length = 6
): StepSequenceResult {
  let startBase = 1;

  if (level === 1) {
    // Level 1: Low starting number (1 or 2)
    startBase = getRandomItem([1, 2]);
  } else if (level === 2) {
    // Level 2: Slightly larger starting number (3 to 6)
    startBase = getRandomInt(3, 6);
  } else {
    // Level 3: Starting number (5 to 12)
    startBase = getRandomInt(5, 12);
  }

  const numbers: number[] = [startBase];
  const steps: string[] = [];
  const signStr = constantAdd >= 0 ? '+' : '-';
  const absAdd = Math.abs(constantAdd);
  const stepLabel = `×${multiplier} ${signStr} ${absAdd}`;

  for (let i = 0; i < length - 1; i++) {
    const prev = numbers[numbers.length - 1];
    const next = prev * multiplier + constantAdd;
    numbers.push(next);
    steps.push(stepLabel);
  }

  return { numbers, steps };
}

/**
 * 2.3 Dedicated Generator for Pure Constant Multiplier (× M):
 * e.g. "Multiply by 2.5" -> T(n) = T(n-1) * 2.5
 * Preserves the EXACT multiplier without addition or ladder distortion!
 */
function generatePureConstantMultSeries(
  multiplier: number,
  level: SeriesPracticeLevel,
  length = 6
): StepSequenceResult {
  let startBase = 2;

  if (multiplier === 2.5) {
    // For 2.5 (5/2), choose even numbers or multiples of 4 to keep numbers neat
    if (level === 1) {
      startBase = getRandomItem([2, 4, 6]);
    } else if (level === 2) {
      startBase = getRandomItem([8, 12, 16]);
    } else {
      startBase = getRandomItem([10, 20, 24]);
    }
  } else if (multiplier === 1.5) {
    // For 1.5 (3/2), choose multiples of 2
    startBase = level === 1 ? getRandomItem([2, 4, 6]) : getRandomItem([8, 12, 16]);
  } else if (multiplier % 1 === 0) {
    // Integer multiplier (e.g. 3, 4, 5)
    startBase = level === 1 ? getRandomInt(2, 5) : getRandomInt(6, 15);
  } else {
    startBase = getRandomItem([2, 4, 8]);
  }

  const numbers: number[] = [startBase];
  const steps: string[] = [];
  const stepLabel = `×${multiplier}`;

  for (let i = 0; i < length - 1; i++) {
    const prev = numbers[numbers.length - 1];
    const rawNext = prev * multiplier;
    // Clean float rounding to avoid JavaScript 31.2500000000001
    const next = Number(rawNext.toFixed(4));
    numbers.push(next);
    steps.push(stepLabel);
  }

  return { numbers, steps };
}

/**
 * Route generator to appropriate mathematical logic based on parsed PatternDNA
 */
function generateSequenceForPattern(
  pattern: SeriesPattern,
  level: SeriesPracticeLevel,
  length = 6
): StepSequenceResult {
  const dna = parsePatternDescriptor(pattern);

  // 1. Prime Squares
  if (dna.family === 'prime_squares') {
    return generatePrimeSquareSeries(level, false, length);
  }

  // 2. Prime Cubes
  if (dna.family === 'prime_cubes') {
    return generatePrimeSquareSeries(level, true, length);
  }

  // 3. Pure Constant Multiplier (e.g. ×2.5)
  if (dna.family === 'constant_multiplier' && dna.multiplier !== undefined) {
    return generatePureConstantMultSeries(dna.multiplier, level, length);
  }

  // 4. Constant Multiplier + Constant Add (e.g. ×5 + 2)
  if (dna.family === 'mult_constant_add' && dna.multiplier !== undefined && dna.constantAdd !== undefined) {
    return generateConstantMultAddSeries(dna.multiplier, dna.constantAdd, level, length);
  }

  // 5. Consecutive Primes (raw primes without powers)
  if (dna.family === 'consecutive_primes') {
    return generatePrimeStepSeries(pattern, level, length);
  }

  // 6. Standard Powers (Squares / Cubes)
  if (dna.family === 'squares' || dna.family === 'cubes') {
    return generatePowerStepSeries(pattern, level, length);
  }

  // 6. Multiplication with growing offsets (e.g. ×2 + 1, ×2 + 3, ×2 + 5)
  if (dna.family === 'mult_variable_add' || dna.family === 'decimal_ladder') {
    return generateMultiplicationSeries(pattern, level, length);
  }

  // 7. Differences (AP / Double Difference / Alternating)
  return generateDifferenceSeries(pattern, level, length);
}

/**
 * Main Public Generator Function
 * Produces a complete SeriesQuestion (either Missing or Wrong Series)
 */
export function generateSeriesQuestion(
  pattern: SeriesPattern,
  level: SeriesPracticeLevel,
  forcedType?: 'missing' | 'wrong'
): SeriesQuestion {
  const length = 6;
  const { numbers, steps } = generateSequenceForPattern(pattern, level, length);

  // In Level 1 & 2: mostly missing series. In Level 3: 50% chance of wrong number series
  const questionType: 'missing' | 'wrong' = 
    forcedType || (level === 3 ? (Math.random() > 0.5 ? 'wrong' : 'missing') : 'missing');

  if (questionType === 'missing') {
    // Missing position depends on level
    // L1: pos 2 or 3 (index 2 or 3)
    // L2: pos 3 or 4 (index 3 or 4)
    // L3: pos 4 or 5 (index 4 or 5)
    let missingIndex = 3;
    if (level === 1) {
      missingIndex = getRandomItem([2, 3]);
    } else if (level === 2) {
      missingIndex = getRandomItem([3, 4]);
    } else {
      missingIndex = getRandomItem([4, 5]);
    }

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
      steps,
      level
    };
  } else {
    // Wrong Number Series:
    // Corrupt one term between index 2 and index 4 so that it creates a dual-difference error
    const culpritIndex = getRandomItem([2, 3, 4]);
    const originalValue = numbers[culpritIndex];
    
    // Corrupt with offset that doesn't accidentally equal neighbors
    const offset = getRandomItem([-8, -6, -4, 4, 6, 8, 12]);
    const corruptedValue = originalValue + offset;

    const displayNumbers: (number | string)[] = [...numbers];
    displayNumbers[culpritIndex] = corruptedValue;

    return {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      patternId: pattern.id,
      patternTitle: pattern.title,
      type: 'wrong',
      numbers: displayNumbers,
      correctAnswer: corruptedValue, // In wrong series, selecting the culprit is the answer
      culpritIndex,
      steps,
      level
    };
  }
}

/**
 * Generate 4 plausible distractor options for multiple-choice speed solving
 */
export function generateDistractorOptions(correctAnswer: number): number[] {
  const options = new Set<number>();
  options.add(correctAnswer);

  const isDecimal = correctAnswer % 1 !== 0;

  if (isDecimal) {
    // For decimals like 31.25 or 12.5, generate realistic decimal variations
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
    const deltas = [-10, -5, -4, -2, -1, 1, 2, 4, 5, 10, 12, 14, 20];
    let attempts = 0;
    while (options.size < 5 && attempts < 50) {
      attempts++;
      const delta = getRandomItem(deltas);
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
