import { DifficultyLevel, OperationSettings } from '../store/speedMathStore';
import { Operation, Question, QuestionGenerator } from './mathTypes';

export type { Operation, Question };

import { generateAddition } from './operations/addition';
import { generateSubtraction } from './operations/subtraction';
import { generateMultiplication } from './operations/multiplication';
import { generateDivision } from './operations/division';
import { generateSquare, generateCube } from './operations/powers';
import { generateFraction } from './operations/fractions';
import { generateTable } from './operations/tables';
import { generateMixture } from './operations/mixture';
import { generateSeriesSpeedMathQuestion } from './series';

const strategyMap: Record<Operation, QuestionGenerator> = {
  '+': generateAddition,
  '-': generateSubtraction,
  '*': generateMultiplication,
  '/': generateDivision,
  'sq': generateSquare,
  'cube': generateCube,
  'frac': generateFraction,
  'table': generateTable,
  'mix': generateMixture,
  'series': generateSeriesSpeedMathQuestion,
};

export function generateQuestion(op: Operation, settings?: OperationSettings, legacyDigitRange?: [number, number]): Question {
  const generator = strategyMap[op];
  if (!generator) {
    // Fallback to addition if not found or handled (or we could throw)
    console.warn(`Unsupported operation: ${op}, falling back to addition`);
    const fallback = generateAddition(settings, legacyDigitRange);
    return { ...fallback, operation: op };
  }
   
  const questionData = generator(settings, legacyDigitRange);
  return { ...questionData, operation: op };
}


