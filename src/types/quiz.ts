import type { Vocabulary } from '../types';

export type VocabularyItem = Vocabulary;

export type QuizFormat =
  | 'cloze'
  | 'fillers'
  | 'synonyms_antonyms'
  | 'spot_error'
  | 'reading_comprehension'
  | 'mixed';

export interface QuizConfig {
  sourceWords: VocabularyItem[]; // Array of up to 15-20 words to test
  format: QuizFormat;
  theme: string; // The custom text box input (e.g., "Cybersecurity", "Harry Potter")
  scope: 'strict' | 'expanded'; // Strict (exact words) vs Expanded (synonyms/antonyms)
}

export interface QuizQuestion {
  id: string;
  questionText: string; // e.g., "The CEO was known for his ____ decisions."
  options: string[]; // 4 options
  correctAnswerIndex: number;
  testedWord: string; // The specific vocab word being tested here
  explanation: string; // Why this is the correct answer
  // For Spot the Error specifically:
  sentenceChunks?: string[]; // e.g., ["He", "has went", "to the", "store."]
}

// The master wrapper returned by Gemini
export interface AIQuizResponse {
  quizTitle: string;
  passageText?: string; // Used ONLY for Cloze Test and Reading Comprehension
  questions: QuizQuestion[];
}

// Interactive Playback & Submission State
export interface QuizSubmissionState {
  answers: Record<string, number>; // questionId -> selected option index
  submitted: boolean;
  score: number;
  wrongWords: string[];
}
