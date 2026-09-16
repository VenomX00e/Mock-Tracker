import { create } from 'zustand';
import type { AIQuizResponse, QuizConfig, VocabularyItem } from '../types';
import { generateAIQuiz } from '../services/quizService';

export interface QuizState {
  // Required core state properties
  activeQuiz: AIQuizResponse | null;
  currentQuestionIndex: number;
  userAnswers: Record<string, number>; // Maps question ID to selected option index
  isGenerating: boolean;

  // Additional transient orchestration state
  isModalOpen: boolean;
  isSubmitted: boolean;
  activeConfig: QuizConfig | null;
  generationError: string | null;
  sourceWords: VocabularyItem[];

  // Actions
  openQuizConfig: (words: VocabularyItem[]) => void;
  closeQuiz: () => void;
  startGeneratingQuiz: (config: QuizConfig) => Promise<void>;
  selectAnswer: (questionId: string, optionIndex: number) => void;
  setCurrentQuestionIndex: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  submitQuiz: () => void;
  resetQuizSession: () => void;
}

export const useQuizStore = create<QuizState>((set, get) => ({
  activeQuiz: null,
  currentQuestionIndex: 0,
  userAnswers: {},
  isGenerating: false,
  isModalOpen: false,
  isSubmitted: false,
  activeConfig: null,
  generationError: null,
  sourceWords: [],

  openQuizConfig: (words: VocabularyItem[]) => {
    set({
      isModalOpen: true,
      sourceWords: words,
      generationError: null,
      isSubmitted: false,
    });
  },

  closeQuiz: () => {
    set({
      isModalOpen: false,
      activeQuiz: null,
      currentQuestionIndex: 0,
      userAnswers: {},
      isGenerating: false,
      isSubmitted: false,
      activeConfig: null,
      generationError: null,
    });
  },

  startGeneratingQuiz: async (config: QuizConfig) => {
    set({
      isGenerating: true,
      generationError: null,
      activeConfig: config,
      userAnswers: {},
      currentQuestionIndex: 0,
      isSubmitted: false,
    });

    try {
      const quizData = await generateAIQuiz(config);
      set({
        activeQuiz: quizData,
        isGenerating: false,
        isModalOpen: false, // Close config dialog as we transition to playing
      });
    } catch (err: any) {
      console.error('useQuizStore: Error generating quiz:', err);
      set({
        isGenerating: false,
        generationError: err?.message || 'Failed to generate AI Quiz. Please try again.',
      });
    }
  },

  selectAnswer: (questionId: string, optionIndex: number) => {
    set((state) => ({
      userAnswers: {
        ...state.userAnswers,
        [questionId]: optionIndex,
      },
    }));
  },

  setCurrentQuestionIndex: (index: number) => {
    const { activeQuiz } = get();
    const total = activeQuiz?.questions?.length || 0;
    const clampedIndex = Math.max(0, Math.min(index, Math.max(0, total - 1)));
    set({ currentQuestionIndex: clampedIndex });
  },

  nextQuestion: () => {
    const { currentQuestionIndex, activeQuiz } = get();
    const total = activeQuiz?.questions?.length || 0;
    if (currentQuestionIndex < total - 1) {
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    }
  },

  prevQuestion: () => {
    const { currentQuestionIndex } = get();
    if (currentQuestionIndex > 0) {
      set({ currentQuestionIndex: currentQuestionIndex - 1 });
    }
  },

  submitQuiz: () => {
    set({ isSubmitted: true });
  },

  resetQuizSession: () => {
    set({
      activeQuiz: null,
      currentQuestionIndex: 0,
      userAnswers: {},
      isSubmitted: false,
      generationError: null,
      isModalOpen: true, // Re-open configuration modal for a new attempt
    });
  },
}));
