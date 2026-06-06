import { QuestionGenerator } from '../mathTypes';
import { getNDigitNumber, getRandomInt } from '../mathUtils';

export const generateDivision: QuestionGenerator = (settings) => {
  const diff = settings?.difficulty || 'EASY';
  let f1 = 1, f2 = 1;

  if (diff === 'BEGINNER') {
    const choice = Math.random();
    if (choice < 0.5) {
      f1 = getNDigitNumber(1); f2 = getNDigitNumber(1);
    } else {
      do { f1 = getNDigitNumber(2); } while (f1 % 10 !== 0 && f1 > 20);
      f2 = getNDigitNumber(1);
    }
  } else if (diff === 'EASY') {
    f1 = getNDigitNumber(2); f2 = getNDigitNumber(1);
  } else if (diff === 'MEDIUM') {
    if (Math.random() < 0.5) {
      f1 = getRandomInt(70, 99); f2 = getRandomInt(6, 9);
    } else {
      f1 = getRandomInt(11, 19); f2 = getRandomInt(11, 19);
    }
  } else if (diff === 'HARD') {
    if (Math.random() < 0.5) {
      f1 = getNDigitNumber(2); f2 = getNDigitNumber(2);
    } else {
      f1 = getNDigitNumber(3); f2 = getNDigitNumber(1);
    }
  } else if (diff === 'CHALLENGING') {
    const choice = Math.random();
    if (choice < 0.33) { f1 = getRandomInt(700, 999); f2 = getRandomInt(6, 9); }
    else if (choice < 0.66) { f1 = getNDigitNumber(3); f2 = getNDigitNumber(2); }
    else { f1 = getNDigitNumber(4); f2 = getNDigitNumber(1); }
  } else if (diff === 'EXPERT') {
    const choice = Math.random();
    if (choice < 0.33) { f1 = getRandomInt(600, 999); f2 = getRandomInt(50, 99); }
    else if (choice < 0.66) { f1 = getNDigitNumber(4); f2 = getNDigitNumber(2); }
    else { f1 = getNDigitNumber(3); f2 = getNDigitNumber(3); }
  }

  const num1 = f1 * f2;
  const num2 = f2;

  return {
    id: Math.random().toString(36).substring(2, 9),
    num1,
    num2,
    displayString: `${num1} ÷ ${num2} = `,
    correctAnswer: f1,
  };
};
