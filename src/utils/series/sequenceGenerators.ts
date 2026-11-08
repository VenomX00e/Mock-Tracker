import { PatternDNA } from './patternParser';
import { ExamDifficultyProfile } from './difficultyTransforms';

export const PRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
];

export interface GeneratedSequence {
  numbers: number[];
  steps: string[];
  hintText: string;
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getStepSign(signMode: '+' | '-' | 'alternating', stepIndex: number): 1 | -1 {
  if (signMode === '-') return -1;
  if (signMode === 'alternating') return stepIndex % 2 === 0 ? 1 : -1;
  return 1;
}

/**
 * 1. Prime Squares / Prime Cubes Generator
 * Supports both Direct Term mode (25, 49, 121, 169) and Step Difference mode (+25, +49, +121)
 * Scales difficulty with stride (consecutive vs alternate primes), sign alternation (+/-), and camouflage (p² ± 1)
 */
function generatePrimePowerSequence(
  dna: PatternDNA,
  profile: ExamDifficultyProfile
): GeneratedSequence {
  const isCube = dna.family === 'prime_cubes' || dna.powerExp === 3;
  const length = isCube ? 5 : profile.seriesLength;

  // Choose prime starting index so numbers remain 2-3 digits (< 999)
  let primeStartIdx = 0;
  if (isCube) {
    primeStartIdx = profile.level === 1 ? 0 : 1; // 2, 3, 5, 7 (7³ = 343)
  } else if (profile.stride === 2) {
    // Alternate primes e.g. [2, 5, 11, 17, 23] or [3, 7, 13, 19, 29]
    primeStartIdx = getRandomItem([0, 1]);
  } else {
    primeStartIdx = profile.level === 1 ? getRandomInt(0, 2) : getRandomInt(1, 3);
  }

  // Direct Term Mode (e.g. "Square of 5 -> Square of 7 -> Square of 11")
  if (profile.effectiveEvalMode === 'term') {
    const numbers: number[] = [];
    const steps: string[] = [];

    for (let i = 0; i < length; i++) {
      const idx = primeStartIdx + i * profile.stride;
      const p = PRIMES[idx] || PRIMES[i];
      const rawPower = isCube ? Math.pow(p, 3) : Math.pow(p, 2);
      const val = rawPower + profile.camouflageDelta;
      numbers.push(val);

      if (profile.camouflageDelta === 0) {
        steps.push(`${p}${isCube ? '³' : '²'} = ${val}`);
      } else {
        const signChar = profile.camouflageDelta > 0 ? '+' : '-';
        steps.push(`${p}${isCube ? '³' : '²'} ${signChar} 1 = ${val}`);
      }
    }

    return {
      numbers,
      steps,
      hintText: `Each term is the ${isCube ? 'cube' : 'square'} of ${
        profile.stride === 2 ? 'alternate' : 'consecutive'
      } prime numbers${profile.camouflageDelta !== 0 ? ` (${profile.camouflageDelta > 0 ? '+1' : '-1'})` : ''}.`,
    };
  }

  // Step / Difference Mode (+ p² or ± p²)
  const startBase =
    profile.signMode === 'alternating'
      ? getRandomInt(120, 220)
      : getRandomInt(8, 35);

  const numbers: number[] = [startBase];
  const steps: string[] = [];

  for (let i = 0; i < length - 1; i++) {
    const stepPos = profile.stepDirection === -1 ? length - 2 - i : i;
    const idx = primeStartIdx + stepPos * profile.stride;
    const p = PRIMES[idx] || PRIMES[i];
    const basePower = isCube ? Math.pow(p, 3) : Math.pow(p, 2);
    const deltaMag = basePower + profile.camouflageDelta;
    const sign = getStepSign(profile.signMode, i);
    const signedDelta = sign * deltaMag;

    const prev = numbers[numbers.length - 1];
    numbers.push(prev + signedDelta);

    const opChar = sign > 0 ? '+' : '-';
    if (profile.camouflageDelta === 0) {
      steps.push(`${opChar} ${p}${isCube ? '³' : '²'} (${deltaMag})`);
    } else {
      const camSign = profile.camouflageDelta > 0 ? '+' : '-';
      steps.push(`${opChar} (${p}${isCube ? '³' : '²'}${camSign}1) [${deltaMag}]`);
    }
  }

  return {
    numbers,
    steps,
    hintText: `Check 1st differences: ${
      profile.stride === 2 ? 'alternate' : 'consecutive'
    } prime ${isCube ? 'cubes' : 'squares'}${
      profile.camouflageDelta !== 0 ? ` disguised by ${profile.camouflageDelta > 0 ? '+1' : '-1'}` : ''
    }.`,
  };
}

/**
 * 2. Standard Powers (Squares / Cubes / n² ± n) Generator
 * Uses gapping (1², 3², 5²), sign alternation, and camouflaged offsets (n² ± 1) to stay < 999
 */
function generatePowerSequence(
  dna: PatternDNA,
  profile: ExamDifficultyProfile
): GeneratedSequence {
  const isCube = dna.family === 'cubes' || dna.powerExp === 3;
  const isNPowerOffset = dna.family === 'n_power_offset';
  const length = isCube ? 5 : profile.seriesLength;

  // Base n starting value
  const baseStart = isCube
    ? getRandomInt(1, 3)
    : profile.stride === 2
    ? getRandomItem([1, 2, 3]) // Odd squares (1,3,5,7,9) or Even squares (2,4,6,8,10)
    : getRandomInt(2, 6);

  if (profile.effectiveEvalMode === 'term') {
    const numbers: number[] = [];
    const steps: string[] = [];

    for (let i = 0; i < length; i++) {
      const n = baseStart + i * profile.stride;
      const powVal = isCube ? Math.pow(n, 3) : Math.pow(n, 2);
      const selfDelta = isNPowerOffset ? (dna.selfOffset || 1) * n : profile.camouflageDelta;
      const val = powVal + selfDelta;
      numbers.push(val);

      if (isNPowerOffset) {
        const sChar = (dna.selfOffset || 1) >= 0 ? '+' : '-';
        steps.push(`${n}${isCube ? '³' : '²'} ${sChar} ${n} = ${val}`);
      } else if (profile.camouflageDelta !== 0) {
        const sChar = profile.camouflageDelta > 0 ? '+' : '-';
        steps.push(`${n}${isCube ? '³' : '²'} ${sChar} 1 = ${val}`);
      } else {
        steps.push(`${n}${isCube ? '³' : '²'} = ${val}`);
      }
    }

    return {
      numbers,
      steps,
      hintText: `Look at direct ${isCube ? 'cubes' : 'squares'} (${
        profile.stride === 2 ? 'odd/even gap' : 'consecutive'
      }).`,
    };
  }

  // Step / Difference mode
  const startBase =
    profile.signMode === 'alternating'
      ? getRandomInt(110, 190)
      : getRandomInt(10, 45);

  const numbers: number[] = [startBase];
  const steps: string[] = [];

  for (let i = 0; i < length - 1; i++) {
    const stepPos = profile.stepDirection === -1 ? length - 2 - i : i;
    const n = baseStart + stepPos * profile.stride;
    const powVal = isCube ? Math.pow(n, 3) : Math.pow(n, 2);
    const extra = isNPowerOffset ? (dna.selfOffset || 1) * n : profile.camouflageDelta;
    const deltaMag = powVal + extra;
    const sign = getStepSign(profile.signMode, i);
    const prev = numbers[numbers.length - 1];
    numbers.push(prev + sign * deltaMag);

    const opChar = sign > 0 ? '+' : '-';
    if (isNPowerOffset) {
      const sChar = (dna.selfOffset || 1) >= 0 ? '+' : '-';
      steps.push(`${opChar} (${n}${isCube ? '³' : '²'}${sChar}${n}) [${deltaMag}]`);
    } else if (profile.camouflageDelta !== 0) {
      const sChar = profile.camouflageDelta > 0 ? '+' : '-';
      steps.push(`${opChar} (${n}${isCube ? '³' : '²'}${sChar}1) [${deltaMag}]`);
    } else {
      steps.push(`${opChar} ${n}${isCube ? '³' : '²'} (${deltaMag})`);
    }
  }

  return {
    numbers,
    steps,
    hintText: `Check 1st differences for ${
      profile.stride === 2 ? 'odd/even gapped' : 'consecutive'
    } ${isCube ? 'cubes' : 'squares'}.`,
  };
}

/**
 * 3. Consecutive / Alternate Primes Generator (+p or ×M + p)
 */
function generateConsecutivePrimeSequence(
  dna: PatternDNA,
  profile: ExamDifficultyProfile
): GeneratedSequence {
  const length = profile.seriesLength;
  const primeStartIdx =
    profile.level === 1
      ? getRandomInt(0, 2) // 2, 3, 5
      : profile.level === 2
      ? getRandomInt(1, 4) // 3, 5, 7, 11
      : getRandomInt(2, 5); // 5, 7, 11, 13

  const startBase =
    profile.signMode === 'alternating'
      ? getRandomInt(80, 150)
      : getRandomInt(12, 48);

  const numbers: number[] = [startBase];
  const steps: string[] = [];

  for (let i = 0; i < length - 1; i++) {
    const stepPos = profile.stepDirection === -1 ? length - 2 - i : i;
    const p = PRIMES[primeStartIdx + stepPos * profile.stride] || PRIMES[i];
    const sign = getStepSign(profile.signMode, i);
    const prev = numbers[numbers.length - 1];
    numbers.push(prev + sign * p);
    steps.push(`${sign > 0 ? '+' : '-'} ${p}`);
  }

  return {
    numbers,
    steps,
    hintText: `Differences follow ${
      profile.stride === 2 ? 'alternate (skipping one)' : 'consecutive'
    } prime numbers.`,
  };
}

/**
 * 4. Constant Multiplier + Offset Generator (e.g. "Multiply by 5 and Add 2")
 * Keeps numbers <= 3 digits (< 999) while scaling difficulty with gapped/alternating offsets!
 */
function generateMultOffsetSequence(
  dna: PatternDNA,
  profile: ExamDifficultyProfile
): GeneratedSequence {
  const mult = dna.multiplier || 2;
  const baseAdd = dna.constantAdd !== undefined ? dna.constantAdd : 2;
  const absAdd = Math.abs(baseAdd);
  const baseSign: 1 | -1 = baseAdd >= 0 ? 1 : -1;

  // Compact 3-Digit Guard:
  // For large multipliers (e.g. ×5 + 2), 5 terms starting at 0 or 1 stays <= 937 (3 digits)!
  // Or in Level 2/3, we can use gapped offsets (e.g. ×M + 2, ×M + 4, ×M + 6) or alternating signs (×M + 2, ×M - 2)
  const length = mult >= 4 ? 5 : profile.seriesLength;

  let startSeed = 1;
  if (mult >= 5) {
    // 0 -> 2 -> 12 -> 62 -> 312 (max 312) OR 1 -> 7 -> 37 -> 187 -> 937 (max 937)
    startSeed = profile.level === 1 ? getRandomItem([0, 1]) : getRandomItem([1, 2]);
  } else if (mult >= 3) {
    startSeed = getRandomInt(1, 4);
  } else {
    startSeed = profile.level === 1 ? getRandomInt(2, 6) : getRandomInt(4, 12);
  }

  const numbers: number[] = [startSeed];
  const steps: string[] = [];

  for (let i = 0; i < length - 1; i++) {
    const prev = numbers[numbers.length - 1];
    let stepOffset = baseAdd;

    if (dna.family === 'mult_variable_add') {
      if (dna.offsetType === 'primes') {
        const p = PRIMES[i * profile.stride] || PRIMES[i];
        const s = profile.level === 3 && i % 2 === 1 ? -1 : baseSign;
        stepOffset = s * p;
      } else {
        // Odd or gapped progression (+1, +3, +5, +7)
        const oddVal = 1 + i * 2 * profile.stride;
        const s = profile.level === 3 && i % 2 === 1 ? -1 : baseSign;
        stepOffset = s * oddVal;
      }
    } else {
      // Constant multiplier + constant add card (e.g. ×5 + 2)
      if (profile.level === 1) {
        // Level 1: Exact constant step (×5 + 2, ×5 + 2, ×5 + 2)
        stepOffset = baseAdd;
      } else if (profile.level === 2) {
        // Level 2: Gapped multiples of the offset (e.g. ×5 + 2, ×5 + 4, ×5 + 6, ×5 + 8) or exact if mult >= 5
        stepOffset = mult >= 5 ? baseAdd : baseSign * absAdd * (i + 1);
      } else {
        // Level 3: Alternating + / - with the exact offset (e.g. ×5 + 2, ×5 - 2, ×5 + 2, ×5 - 2)
        const altSign = i % 2 === 0 ? 1 : -1;
        stepOffset = altSign * absAdd;
      }
    }

    const next = prev * mult + stepOffset;
    numbers.push(next);

    const signStr = stepOffset >= 0 ? '+' : '-';
    steps.push(`×${mult} ${signStr} ${Math.abs(stepOffset)}`);
  }

  return {
    numbers,
    steps,
    hintText: `Multiply each term by ${mult} and ${
      profile.level === 3 ? 'alternate adding/subtracting' : 'apply'
    } the offset.`,
  };
}

/**
 * 5. Pure Constant Multiplier & Decimal Ladder Generator (e.g. "Multiply by 2.5" or "×0.5, ×1, ×1.5, ×2")
 */
function generateMultiplierOrDecimalSequence(
  dna: PatternDNA,
  profile: ExamDifficultyProfile
): GeneratedSequence {
  if (dna.family === 'constant_multiplier' && dna.multiplier !== undefined) {
    const mult = dna.multiplier;
    const length = mult >= 3 ? 5 : 5;
    let startBase = 4;

    if (mult === 2.5) {
      // 8 -> 20 -> 50 -> 125 -> 312.5 (all <= 3 digits!)
      // 4 -> 10 -> 25 -> 62.5 -> 156.25
      // 12 -> 30 -> 75 -> 187.5 -> 468.75
      startBase =
        profile.level === 1
          ? getRandomItem([8, 16])
          : profile.level === 2
          ? getRandomItem([4, 12])
          : getRandomItem([6, 10, 14]);
    } else if (mult === 1.5) {
      // 8 -> 12 -> 18 -> 27 -> 40.5 OR 16 -> 24 -> 36 -> 54 -> 81
      startBase =
        profile.level === 1
          ? getRandomItem([16, 32, 48])
          : profile.level === 2
          ? getRandomItem([8, 24, 40])
          : getRandomItem([12, 20, 28]);
    } else {
      startBase = profile.level === 1 ? getRandomInt(2, 4) : getRandomInt(3, 7);
    }

    const numbers: number[] = [startBase];
    const steps: string[] = [];

    for (let i = 0; i < length - 1; i++) {
      const prev = numbers[numbers.length - 1];
      const next = Number((prev * mult).toFixed(4));
      numbers.push(next);
      steps.push(`×${mult}`);
    }

    return {
      numbers,
      steps,
      hintText: `Check the ratio between consecutive terms (×${mult}).`,
    };
  }

  // Decimal Ladder (e.g. ×0.5, ×1, ×1.5, ×2, ×2.5 or gapped ×0.5, ×1.5, ×2.5, ×3.5 in L2/L3)
  const length = 5;
  const multStep = profile.stride === 2 ? 1.0 : dna.multStep || 0.5;
  const multStart = dna.multStart || 0.5;
  const startBase =
    profile.level === 1
      ? getRandomItem([16, 24, 32, 40])
      : getRandomItem([12, 20, 28, 36]);

  const numbers: number[] = [startBase];
  const steps: string[] = [];

  for (let i = 0; i < length - 1; i++) {
    const curMult = multStart + i * multStep;
    const prev = numbers[numbers.length - 1];
    const next = Number((prev * curMult).toFixed(4));
    numbers.push(next);
    steps.push(`×${curMult}`);
  }

  return {
    numbers,
    steps,
    hintText: `Half-step decimal multiplier ladder starting at ×${multStart} (increasing by +${multStep}).`,
  };
}

/**
 * 6. Sequential Growing Multiplier (×1+1, ×2+2, ×3+3, ×4+4)
 */
function generateGrowingMultSequence(
  profile: ExamDifficultyProfile
): GeneratedSequence {
  const length = 5; // 5 terms keeps maximum number < 500
  const startBase = profile.level === 1 ? getRandomInt(2, 5) : getRandomInt(3, 8);
  const numbers: number[] = [startBase];
  const steps: string[] = [];

  for (let i = 0; i < length - 1; i++) {
    const m = i + 1;
    const offset = profile.stride === 2 ? m * 2 : m;
    const sign = profile.level === 3 && i % 2 === 1 ? -1 : 1;
    const prev = numbers[numbers.length - 1];
    const next = prev * m + sign * offset;
    numbers.push(next);
    steps.push(`×${m} ${sign > 0 ? '+' : '-'} ${offset}`);
  }

  return {
    numbers,
    steps,
    hintText: `Sequential multiplier (×1, ×2, ×3, ×4) with a matching step offset.`,
  };
}

/**
 * 7. Arithmetic & Double Difference Generator
 */
function generateDifferenceSequence(
  dna: PatternDNA,
  profile: ExamDifficultyProfile
): GeneratedSequence {
  const length = profile.seriesLength;

  if (dna.family === 'double_difference' || (profile.level === 2 && dna.family === 'ap_difference' && !dna.diffStep)) {
    // Double Difference: 1st diffs grow by +6, +8, +10, +12 (2nd difference is constant)
    const startBase = getRandomInt(12, 45);
    let curDiff = getRandomItem([6, 8, 10, 12]);
    const secondDiffBase = getRandomItem([4, 6, 8]);
    const numbers: number[] = [startBase];
    const steps: string[] = [];

    for (let i = 0; i < length - 1; i++) {
      const prev = numbers[numbers.length - 1];
      numbers.push(prev + curDiff);
      steps.push(`+ ${curDiff}`);
      curDiff += secondDiffBase * (i + 1);
    }

    return {
      numbers,
      steps,
      hintText: `Take the difference of differences (Double Difference series).`,
    };
  }

  // Standard or Alternating AP Difference (e.g. +12, +24, +36 or +15, -30, +45, -60)
  const unitDiff = dna.diffStep || getRandomItem([6, 7, 8, 9, 11, 12, 13, 15]);
  const startBase =
    profile.signMode === 'alternating'
      ? getRandomInt(120, 210)
      : getRandomInt(15, 65);

  const numbers: number[] = [startBase];
  const steps: string[] = [];

  for (let i = 0; i < length - 1; i++) {
    const stepPos = profile.stepDirection === -1 ? length - 2 - i : i;
    const multFactor = 1 + stepPos * profile.stride;
    const delta = unitDiff * multFactor;
    const sign = getStepSign(profile.signMode, i);
    const prev = numbers[numbers.length - 1];
    numbers.push(prev + sign * delta);
    steps.push(`${sign > 0 ? '+' : '-'} ${delta}`);
  }

  return {
    numbers,
    steps,
    hintText: `Differences are multiples of ${unitDiff} (${
      profile.signMode === 'alternating' ? 'alternating + and -' : 'in arithmetic progression'
    }).`,
  };
}

/**
 * Main Dispatcher: Routes parsed PatternDNA + ExamDifficultyProfile to exact mathematical sequence generator
 */
export function generateMathematicalSequence(
  dna: PatternDNA,
  profile: ExamDifficultyProfile
): GeneratedSequence {
  switch (dna.family) {
    case 'prime_squares':
    case 'prime_cubes':
      return generatePrimePowerSequence(dna, profile);

    case 'squares':
    case 'cubes':
    case 'n_power_offset':
      return generatePowerSequence(dna, profile);

    case 'consecutive_primes':
      return generateConsecutivePrimeSequence(dna, profile);

    case 'mult_constant_add':
    case 'mult_variable_add':
      return generateMultOffsetSequence(dna, profile);

    case 'constant_multiplier':
    case 'decimal_ladder':
      return generateMultiplierOrDecimalSequence(dna, profile);

    case 'growing_mult_offset':
      return generateGrowingMultSequence(profile);

    case 'double_difference':
    case 'ap_difference':
    default:
      return generateDifferenceSequence(dna, profile);
  }
}
