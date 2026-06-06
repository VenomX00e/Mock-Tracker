import { QuestionGenerator } from '../mathTypes';
import { getNDigitNumber, getRandomInt } from '../mathUtils';

export const generateMultiplication: QuestionGenerator = (settings) => {
  const diff = settings?.difficulty || 'EASY';
  let num1 = 0, num2 = 0;

  if (diff === 'BEGINNER') {
    const choice = Math.random();
    if (choice < 0.5) {
      num1 = getNDigitNumber(1);
      num2 = getNDigitNumber(1);
    } else {
      num1 = getNDigitNumber(2);
      do { num1 = getNDigitNumber(2); } while (num1 % 10 !== 0 && num1 > 20);
      num2 = getNDigitNumber(1);
    }
  } else if (diff === 'EASY') {
    num1 = getNDigitNumber(2);
    num2 = getNDigitNumber(1);
  } else if (diff === 'MEDIUM') {
    const choice = Math.random();
    if (choice < 0.5) {
      num1 = getRandomInt(70, 99);
      num2 = getRandomInt(6, 9);
    } else {
      num1 = getRandomInt(11, 19);
      num2 = getRandomInt(11, 19);
    }
  } else if (diff === 'HARD') {
    const choice = Math.random();
    if (choice < 0.5) {
      num1 = getNDigitNumber(2);
      num2 = getNDigitNumber(2);
    } else {
      num1 = getNDigitNumber(3);
      num2 = getNDigitNumber(1);
    }
  } else if (diff === 'CHALLENGING') {
    const choice = Math.random();
    if (choice < 0.33) {
      num1 = getRandomInt(700, 999);
      num2 = getRandomInt(6, 9);
    } else if (choice < 0.66) {
      num1 = getNDigitNumber(3);
      num2 = getNDigitNumber(2);
    } else {
      num1 = getNDigitNumber(4);
      num2 = getNDigitNumber(1);
    }
  } else if (diff === 'EXPERT') {
    const choice = Math.random();
    if (choice < 0.33) {
      num1 = getRandomInt(600, 999);
      num2 = getRandomInt(50, 99);
    } else if (choice < 0.66) {
      num1 = getNDigitNumber(4);
      num2 = getNDigitNumber(2);
    } else {
      num1 = getNDigitNumber(3);
      num2 = getNDigitNumber(3);
    }
  }

  if (Math.random() > 0.5) { const t = num1; num1 = num2; num2 = t; }

  return {
    id: Math.random().toString(36).substring(2, 9),
    num1,
    num2,
    displayString: `${num1} × ${num2} = `,
    correctAnswer: num1 * num2,
  };
};
