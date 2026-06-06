import { QuestionGenerator } from '../mathTypes';
import { getExhaustiveRandomFromRanges, getRandomInt } from '../mathUtils';

export const generateFraction: QuestionGenerator = (settings) => {
  const customRanges = settings?.customRanges || '1-10';
  const isReverse = settings?.isReverse || false;

  const den = getExhaustiveRandomFromRanges(customRanges, 'frac');
  
  let num1: number;
  let num2: number;
  let answer: number;
  let displayString: string;
  let multiAnswer: number[] | undefined = undefined;

  if (den === 0) {
    // Fallback for division by zero
    num1 = 1; 
    num2 = 2; 
    if (isReverse) {
      answer = 0; 
      displayString = `50% = `; 
      multiAnswer = [1, 2];
    } else {
      answer = 50; 
      displayString = `1/2 in % = `;
    }
  } else {
    const num = getRandomInt(1, den - 1) || 1; // || 1 in case den is 1
    num1 = num;
    num2 = den;
    if (isReverse) {
      answer = 0;
      displayString = `${Number(((num / den) * 100).toFixed(2))}% = `;
      multiAnswer = [num, den];
    } else {
      answer = Number(((num / den) * 100).toFixed(2));
      displayString = `${num}/${den} in % = `;
    }
  }

  return {
    id: Math.random().toString(36).substring(2, 9),
    num1,
    num2,
    displayString,
    correctAnswer: answer,
    multiAnswer
  };
};
