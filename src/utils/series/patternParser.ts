import { SeriesPattern } from '../../types/seriesTypes';

export type PatternFamily =
  | 'prime_squares'       // p² (either term = p² or step = ±p²)
  | 'prime_cubes'         // p³ (either term = p³ or step = ±p³)
  | 'consecutive_primes'  // p (step = ±p)
  | 'squares'             // n² (either term = n² or step = ±n²)
  | 'cubes'               // n³ (either term = n³ or step = ±n³)
  | 'n_power_offset'      // n² ± n or n³ ± n or n² ± 1
  | 'constant_multiplier' // × M on every step (e.g. ×2.5, ×2.5, ×2.5)
  | 'mult_constant_add'   // × M ± C (e.g. ×5 + 2, ×5 + 2)
  | 'mult_variable_add'   // × M ± (growing: odds, naturals, primes)
  | 'growing_mult_offset' // ×1 + 1, ×2 + 2, ×3 + 3 or ×1 + 1², ×2 + 2²
  | 'decimal_ladder'      // × 0.5, × 1.0, × 1.5, × 2.0 (stepwise decimal multipliers)
  | 'double_difference'   // + d1, + d2 where 2nd difference is constant/AP
  | 'ap_difference';      // + 7, + 14, + 21

export interface PatternDNA {
  family: PatternFamily;
  /**
   * 'term': The terms themselves are generated directly by the rule (e.g. "Square of 5" -> 25, 49, 121)
   * 'step': Each step modifies the previous term (e.g. "+ 5²" -> prev + 25)
   */
  evaluationMode: 'term' | 'step';
  multiplier?: number;      // e.g. 2.5 or 5
  constantAdd?: number;     // e.g. 2 or -3
  operationSign?: '+' | '-' | 'alternating';
  powerExp?: 2 | 3;
  selfOffset?: 1 | -1 | 0;  // for n² + n (+1) or n² - n (-1)
  constantCamouflage?: number; // for n² + 1 or n² - 1
  offsetType?: 'primes' | 'odds' | 'naturals' | 'squares' | 'multiples';
  diffStep?: number;        // e.g. 7 for +7, +14, +21
  multStart?: number;       // e.g. 0.5 for decimal ladder
  multStep?: number;        // e.g. 0.5 for decimal ladder
  stepDeltas?: number[];    // raw parsed deltas if custom
  initialStride?: number;   // 1 = consecutive, 2 = odd/even/alternate skip
}

/**
 * Extracts the exact mathematical DNA from both:
 * 1. Structured AI Blueprint `generatorParams` (Suggestion 2)
 * 2. Step-Expression & Title Introspection for existing Vault cards (Suggestion 1)
 */
export function parsePatternDescriptor(pattern: SeriesPattern): PatternDNA {
  const params = pattern.generatorParams || {};
  const title = (pattern.title || '').toLowerCase();
  const steps = (pattern.steps || []).map((s) => s.trim());
  const stepsJoined = steps.join(' ').toLowerCase();
  const key = (pattern.generatorKey || '').toLowerCase();

  // Check if steps explicitly have +/- or ×/* prefixes (indicating 'step' mode)
  // vs descriptive term labels like "Square of 5", "5²", "2³ + 1" without leading +/-
  const hasLeadingStepOperator = steps.some((s) => /^[+\-×*÷/x]/i.test(s));
  const hasTermPhrase =
    steps.some((s) => /^(?:square|cube)\s+of\s+\d+/i.test(s)) ||
    (!hasLeadingStepOperator &&
      steps.length > 0 &&
      steps.every((s) => /^\d+\s*(?:²|³|\^2|\^3)/.test(s)));

  const defaultEvalMode: 'term' | 'step' =
    params.evaluationMode === 'term' || params.mode === 'term' || hasTermPhrase
      ? 'term'
      : 'step';

  // Detect sign alternation in saved steps (e.g. ["+ 15", "- 30", "+ 45", "- 60"])
  const hasPlus = steps.some((s) => s.startsWith('+'));
  const hasMinus = steps.some((s) => s.startsWith('-'));
  const isAlternatingSign =
    params.signRule === 'alternating' ||
    pattern.category === 'alternating' ||
    title.includes('alternat') ||
    (hasPlus && hasMinus);

  // 0. Direct Blueprint Family Override if explicitly provided in generatorParams
  if (params.family) {
    return {
      family: params.family as PatternFamily,
      evaluationMode: defaultEvalMode,
      multiplier: params.multiplier,
      constantAdd: params.constantAdd,
      operationSign: isAlternatingSign ? 'alternating' : (params.operationSign || '+'),
      powerExp: params.powerExp,
      selfOffset: params.selfOffset,
      offsetType: params.offsetType,
      diffStep: params.diffStep,
      multStart: params.multStart,
      multStep: params.multStep,
      initialStride: params.stride || 1,
    };
  }

  // 1. Prime Squares / Prime Cubes Detection
  // e.g. "Squares of Consecutive Primes", steps: ["Square of 5", "Square of 7"] or ["+ 5²", "+ 7²"]
  const hasSquareWord =
    title.includes('square') ||
    stepsJoined.includes('square') ||
    stepsJoined.includes('²') ||
    stepsJoined.includes('^2');
  const hasCubeWord =
    title.includes('cube') ||
    stepsJoined.includes('cube') ||
    stepsJoined.includes('³') ||
    stepsJoined.includes('^3');
  const hasPrimeWord =
    pattern.category === 'primes' ||
    title.includes('prime') ||
    key.includes('prime') ||
    stepsJoined.includes('prime');

  if (hasPrimeWord && hasSquareWord && !stepsJoined.includes('×') && !stepsJoined.includes('*')) {
    return {
      family: 'prime_squares',
      evaluationMode: defaultEvalMode,
      powerExp: 2,
      operationSign: isAlternatingSign ? 'alternating' : '+',
    };
  }
  if (hasPrimeWord && hasCubeWord && !stepsJoined.includes('×') && !stepsJoined.includes('*')) {
    return {
      family: 'prime_cubes',
      evaluationMode: defaultEvalMode,
      powerExp: 3,
      operationSign: isAlternatingSign ? 'alternating' : '+',
    };
  }

  // 2. Pure Multiplier Steps Detection (e.g. ["×2.5", "×2.5"] or ["×0.5", "×1", "×1.5", "×2"])
  const pureMultRegex = /^(?:×|\*|x)\s*(\d+(?:\.\d+)?)$/i;
  const parsedPureMultSteps = steps.map((s) => {
    const match = s.match(pureMultRegex);
    return match ? parseFloat(match[1]) : null;
  });

  if (parsedPureMultSteps.length > 0 && parsedPureMultSteps.every((m) => m !== null)) {
    const mults = parsedPureMultSteps as number[];
    const firstMult = mults[0];
    const allSame = mults.every((m) => Math.abs(m - firstMult) < 0.001);
    if (allSame) {
      return {
        family: 'constant_multiplier',
        evaluationMode: 'step',
        multiplier: firstMult,
      };
    } else {
      const stepDiff = mults.length >= 2 ? Number((mults[1] - mults[0]).toFixed(2)) : 0.5;
      return {
        family: 'decimal_ladder',
        evaluationMode: 'step',
        multStart: firstMult,
        multStep: stepDiff > 0 ? stepDiff : 0.5,
      };
    }
  }

  // 3. Multiplication + Offset Detection (e.g. "×5 + 2", "×2 + 3, ×2 + 5", "×1 + 1, ×2 + 2")
  const multOffsetRegex = /(?:×|\*|x)\s*(\d+(?:\.\d+)?)\s*([+\-])\s*(\d+)/i;
  const parsedMultSteps = steps
    .map((s) => {
      const match = s.match(multOffsetRegex);
      if (match) {
        return {
          multiplier: parseFloat(match[1]),
          sign: match[2] as '+' | '-',
          addVal: parseInt(match[3], 10),
        };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (parsedMultSteps.length > 0) {
    const first = parsedMultSteps[0];
    const allSameMultiplier = parsedMultSteps.every((p) => p.multiplier === first.multiplier);
    const allSameAdd = parsedMultSteps.every(
      (p) => p.addVal === first.addVal && p.sign === first.sign
    );

    if (allSameMultiplier && allSameAdd) {
      return {
        family: 'mult_constant_add',
        evaluationMode: 'step',
        multiplier: first.multiplier,
        constantAdd: first.sign === '-' ? -first.addVal : first.addVal,
        operationSign: first.sign,
      };
    }

    if (allSameMultiplier && !allSameAdd) {
      const addVals = parsedMultSteps.map((p) => p.addVal);
      const isPrimeAdder =
        hasPrimeWord ||
        (addVals.length >= 3 && [2, 3, 5, 7, 11, 13, 17, 19].includes(addVals[0]) && [3, 5, 7, 11, 13, 17, 19, 23].includes(addVals[1]));
      return {
        family: 'mult_variable_add',
        evaluationMode: 'step',
        multiplier: first.multiplier,
        offsetType: isPrimeAdder ? 'primes' : 'odds',
        operationSign: isAlternatingSign ? 'alternating' : first.sign,
        stepDeltas: parsedMultSteps.map((p) => (p.sign === '-' ? -p.addVal : p.addVal)),
      };
    }

    // Growing multiplier (e.g. ×1 + 1, ×2 + 2, ×3 + 3)
    return {
      family: 'growing_mult_offset',
      evaluationMode: 'step',
      operationSign: isAlternatingSign ? 'alternating' : first.sign,
    };
  }

  // Title fallback for "Multiply by M and Add/Subtract C"
  const titleMultAddMatch = title.match(
    /multiply by (\d+(?:\.\d+)?)\s*(?:and\s*)?([+\-]|add|subtract)\s*(\d+)/i
  );
  if (titleMultAddMatch) {
    const mult = parseFloat(titleMultAddMatch[1]);
    const isSub = titleMultAddMatch[2].includes('-') || titleMultAddMatch[2].includes('sub');
    const val = parseInt(titleMultAddMatch[3], 10);
    return {
      family: 'mult_constant_add',
      evaluationMode: 'step',
      multiplier: mult,
      constantAdd: isSub ? -val : val,
      operationSign: isSub ? '-' : '+',
    };
  }

  // Title fallback for pure multiplier "Multiply by 2.5"
  const titlePureMultMatch = title.match(/multiply by (\d+(?:\.\d+)?)/i);
  if (titlePureMultMatch && !hasPrimeWord) {
    return {
      family: 'constant_multiplier',
      evaluationMode: 'step',
      multiplier: parseFloat(titlePureMultMatch[1]),
    };
  }

  // 4. Decimal Ladder fallback
  if (steps.some((s) => s.includes('0.5')) && steps.some((s) => s.includes('1.5'))) {
    return {
      family: 'decimal_ladder',
      evaluationMode: 'step',
      multStart: 0.5,
      multStep: 0.5,
    };
  }

  // 5. n² ± n or n³ ± n Detection (e.g. "n² + n", "2² + 2", "3³ - 3")
  if (
    title.includes('n² + n') ||
    title.includes('n² - n') ||
    title.includes('n³ + n') ||
    title.includes('n³ - n') ||
    steps.some((s) => /\d+[²³]\s*[+\-]\s*\d+/.test(s))
  ) {
    const isMinus = title.includes('-') || steps.some((s) => /\d+[²³]\s*-/.test(s));
    return {
      family: 'n_power_offset',
      evaluationMode: defaultEvalMode,
      powerExp: hasCubeWord ? 3 : 2,
      selfOffset: isMinus ? -1 : 1,
      operationSign: isAlternatingSign ? 'alternating' : '+',
    };
  }

  // 6. Consecutive Primes (raw primes without powers)
  if (hasPrimeWord) {
    return {
      family: 'consecutive_primes',
      evaluationMode: 'step',
      multiplier: params.multiplier,
      operationSign: isAlternatingSign ? 'alternating' : '+',
    };
  }

  // 7. Standard Powers (Squares / Cubes)
  if (hasCubeWord) {
    return {
      family: 'cubes',
      evaluationMode: defaultEvalMode,
      powerExp: 3,
      operationSign: isAlternatingSign ? 'alternating' : '+',
    };
  }
  if (hasSquareWord) {
    return {
      family: 'squares',
      evaluationMode: defaultEvalMode,
      powerExp: 2,
      operationSign: isAlternatingSign ? 'alternating' : '+',
    };
  }

  // 8. Double Difference
  if (title.includes('double') || key.includes('double')) {
    return {
      family: 'double_difference',
      evaluationMode: 'step',
      operationSign: '+',
    };
  }

  // 9. Extract custom arithmetic progression step if steps are "+ 12", "+ 24", "+ 36"
  const rawDiffNums = steps
    .map((s) => {
      const m = s.match(/^([+\-])\s*(\d+)$/);
      return m ? parseInt(m[2], 10) : null;
    })
    .filter((n): n is number => n !== null);

  let inferredDiffStep: number | undefined;
  if (rawDiffNums.length >= 2) {
    const delta = Math.abs(rawDiffNums[1] - rawDiffNums[0]);
    if (delta > 0 && delta <= 30) {
      inferredDiffStep = delta;
    }
  }

  return {
    family: 'ap_difference',
    evaluationMode: 'step',
    diffStep: params.diffStep || inferredDiffStep,
    operationSign: isAlternatingSign ? 'alternating' : '+',
  };
}
