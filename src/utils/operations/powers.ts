import { QuestionGenerator } from '../mathTypes';
import { getExhaustiveRandomFromRanges } from '../mathUtils';

export const generateSquare: QuestionGenerator = (settings) => {
  const customRanges = settings?.customRanges || '1-10';
  const isReverse = settings?.isReverse || false;

  const num1 = getExhaustiveRandomFromRanges(customRanges, 'sq');
  
  let answer: number;
  let displayString: string;

  if (isReverse) {
    answer = num1;
    displayString = `sqrt(${num1 * num1}) = `;
  } else {
    answer = num1 * num1;
    displayString = `${num1}^2 = `;
  }

  return {
    id: Math.random().toString(36).substring(2, 9),
    num1,
    num2: undefined,
    displayString,
    correctAnswer: answer,
  };
};

export const generateCube: QuestionGenerator = (settings) => {
  const customRanges = settings?.customRanges || '1-10';
  const isReverse = settings?.isReverse || false;

  const num1 = getExhaustiveRandomFromRanges(customRanges, 'cube');
  
  let answer: number;
  let displayString: string;

  if (isReverse) {
    answer = num1;
    displayString = `cbrt(${num1 * num1 * num1}) = `;
  } else {
    answer = num1 * num1 * num1;
    displayString = `${num1}^3 = `;
  }

  return {
    id: Math.random().toString(36).substring(2, 9),
    num1,
    num2: undefined,
    displayString,
    correctAnswer: answer,
  };
};
