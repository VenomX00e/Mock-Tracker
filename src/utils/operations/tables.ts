import { QuestionGenerator } from '../mathTypes';
import { getExhaustiveTableCombination } from '../mathUtils';

export const generateTable: QuestionGenerator = (settings) => {
  const customRanges = settings?.customRanges || '1-10';
  const isReverse = settings?.isReverse || false;

  const combo = getExhaustiveTableCombination(customRanges);
  let num1 = combo.n1;
  let num2 = combo.n2;
  
  if (Math.random() > 0.5) {
    const t = num1; num1 = num2; num2 = t;
  }
  
  let answer: number;
  let displayString: string;
  let multiAnswer: number[] | undefined = undefined;

  if (isReverse) {
    answer = 0;
    displayString = `${num1 * num2} = `;
    const max = Math.max(num1, num2);
    const min = Math.min(num1, num2);
    multiAnswer = [max, min];
  } else {
    answer = num1 * num2;
    displayString = `${num1} × ${num2} = `;
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
