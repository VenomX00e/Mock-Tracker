import { OperationSettings } from '../store/speedMathStore';

export type Operation = '+' | '-' | '*' | '/' | 'sq' | 'cube' | 'frac' | 'table' | 'mix' | 'series';

export interface ASTNode {
  type: 'number' | 'operation';
  value?: number;
  operator?: '+' | '-' | '*' | '/';
  left?: ASTNode;
  right?: ASTNode;
  displayFormat?: string;
}

export interface SeriesQuestionMetadata {
  type: 'missing' | 'wrong';
  numbers: (number | string)[];
  steps: string[];
  patternTitle: string;
  patternCategory: string;
  culpritIndex?: number;
  wrongReplacement?: number;
  hintText?: string;
}

export interface Question {
  id: string;
  num1: number;
  num2?: number;
  operation: Operation;
  displayString: string;
  correctAnswer: number;
  multiAnswer?: number[];
  seriesData?: SeriesQuestionMetadata;
}

export type QuestionGenerator = (settings?: OperationSettings, legacyDigitRange?: [number, number]) => Omit<Question, 'operation'>;
