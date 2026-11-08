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
  retryMissedWords: (missedWords: VocabularyItem[]) => Promise<void>;
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
        isModalOpen: false,
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
      isModalOpen: true,
    });
  },

  retryMissedWords: async (missedWords: VocabularyItem[]) => {
    if (!missedWords || missedWords.length === 0) return;
    const { activeConfig } = get();
    const retryCount = (
      missedWords.length <= 5
        ? 5
        : missedWords.length <= 10
        ? 10
        : missedWords.length <= 15
        ? 15
        : 20
    ) as 5 | 10 | 15 | 20;

    const nextConfig: QuizConfig = {
      sourceWords: missedWords,
      format: activeConfig?.format || 'fillers',
      theme: activeConfig?.theme || '',
      scope: activeConfig?.scope || 'strict',
      questionCount: retryCount,
      wordPool: activeConfig?.wordPool || 'all',
    };

    await get().startGeneratingQuiz(nextConfig);
  },
}));
