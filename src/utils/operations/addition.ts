import { QuestionGenerator } from '../mathTypes';
import { getAdditionPair, getNDigitNumber } from '../mathUtils';

export const generateAddition: QuestionGenerator = (settings) => {
  const diff = settings?.difficulty || 'EASY';
  let num1 = 0, num2 = 0;

  if (diff === 'BEGINNER') {
    const choice = Math.random();
    if (choice < 0.5) {
      [num1, num2] = getAdditionPair(1, 1, false);
    } else {
      [num1, num2] = getAdditionPair(2, 1, false);
    }
  } else if (diff === 'EASY') {
    const choice = Math.random();
    if (choice < 0.5) {
      [num1, num2] = getAdditionPair(2, 2, false);
    } else {
      [num1, num2] = getAdditionPair(2, 1, true);
    }
  } else if (diff === 'MEDIUM') {
    const choice = Math.random();
    if (choice < 0.5) {
      num1 = getNDigitNumber(3);
      num2 = getNDigitNumber(2);
    } else {
      [num1, num2] = getAdditionPair(3, 3, false);
    }
  } else if (diff === 'HARD') {
    [num1, num2] = getAdditionPair(3, 3, true);
  } else if (diff === 'CHALLENGING') {
    const choice = Math.random();
    if (choice < 0.5) {
      num1 = getNDigitNumber(4);
      num2 = getNDigitNumber(3);
    } else {
      num1 = getNDigitNumber(4);
      num2 = getNDigitNumber(4);
    }
  } else if (diff === 'EXPERT') {
    const choice = Math.random();
    if (choice < 0.5) {
      num1 = getNDigitNumber(5);
      num2 = getNDigitNumber(4);
    } else {
      num1 = getNDigitNumber(5);
      num2 = getNDigitNumber(5);
    }
  }

  if (Math.random() > 0.5) {
    const t = num1; num1 = num2; num2 = t;
  }

  return {
    id: Math.random().toString(36).substring(2, 9),
    num1,
    num2,
    displayString: `${num1} + ${num2} = `,
    correctAnswer: num1 + num2,
  };
};
