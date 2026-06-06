import { QuestionGenerator } from '../mathTypes';
import { getSubtractionPair, getNDigitNumber, getRandomInt } from '../mathUtils';

export const generateSubtraction: QuestionGenerator = (settings) => {
  const diff = settings?.difficulty || 'EASY';
  let num1 = 0, num2 = 0;

  if (diff === 'BEGINNER') {
    const choice = Math.random();
    if (choice < 0.5) {
      [num1, num2] = getSubtractionPair(1, 1, false);
    } else {
      [num1, num2] = getSubtractionPair(2, 1, false);
    }
  } else if (diff === 'EASY') {
    const choice = Math.random();
    if (choice < 0.5) {
      [num1, num2] = getSubtractionPair(2, 2, false);
    } else {
      [num1, num2] = getSubtractionPair(2, 1, true);
    }
  } else if (diff === 'MEDIUM') {
    const choice = Math.random();
    if (choice < 0.5) {
      num1 = getNDigitNumber(3);
      num2 = getNDigitNumber(2);
    } else {
      [num1, num2] = getSubtractionPair(3, 3, true, 0);
      num2 = getNDigitNumber(2);
      num1 = num2 + getRandomInt(1, 20);
    }
  } else if (diff === 'HARD') {
    [num1, num2] = getSubtractionPair(3, 3, true, 100);
  } else if (diff === 'CHALLENGING') {
    const choice = Math.random();
    if (choice < 0.5) {
      [num1, num2] = getSubtractionPair(4, 3, true);
    } else {
      [num1, num2] = getSubtractionPair(4, 4, true, 500);
    }
  } else if (diff === 'EXPERT') {
    const choice = Math.random();
    if (choice < 0.5) {
      [num1, num2] = getSubtractionPair(5, 4, true);
    } else {
      [num1, num2] = getSubtractionPair(5, 5, true, 5000);
    }
  }

  if (num1 < num2) { const t = num1; num1 = num2; num2 = t; }

  return {
    id: Math.random().toString(36).substring(2, 9),
    num1,
    num2,
    displayString: `${num1} - ${num2} = `,
    correctAnswer: num1 - num2,
  };
};
