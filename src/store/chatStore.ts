import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatMessage } from '../services/learningGeminiService';

export type ChatMode = 'default' | 'math' | 'english' | 'reasoning';

interface ChatState {
  messagesByMode: Record<ChatMode, ChatMessage[]>;
  persistLocally: boolean;
  showWebSearchButton: boolean;
  useCustomWebSearch: boolean;
  addMessage: (mode: ChatMode, message: ChatMessage) => void;
  setMessages: (mode: ChatMode, messages: ChatMessage[]) => void;
  toggleLocalPersistence: () => void;
  toggleWebSearchButton: () => void;
  toggleCustomWebSearch: () => void;
  clearHistory: (mode?: ChatMode) => void;
}

const defaultWelcomeMessages: Record<ChatMode, ChatMessage[]> = {
  default: [
    { role: 'model', text: "Hi! I'm your AI Learning Tutor. What topic would you like to explore today?" }
  ],
  math: [
    { role: 'model', text: "Welcome to Quant mode! Send me a quantitative aptitude or math problem, and I'll give you a rapid, exam-focused, step-by-step approach." }
  ],
  english: [
    { role: 'model', text: "Welcome to English Expert mode! Let's solve grammar rules, vocabulary, or comprehension puzzles using short, concise rules." }
  ],
  reasoning: [
    { role: 'model', text: "Welcome to Reasoning & Logic Puzzles mode! Please make sure Gemini 3.5 Flash is active in your settings for best results. Enter a seating arrangement or puzzle, and I'll break it down using efficient exam approaches like the Thread Method!" }
  ]
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messagesByMode: defaultWelcomeMessages,
      persistLocally: false,
      showWebSearchButton: false,
      useCustomWebSearch: false,
      
      addMessage: (mode, message) => set((state) => ({
        messagesByMode: {
          ...state.messagesByMode,
          [mode]: [...state.messagesByMode[mode], message]
        }
      })),
      
      setMessages: (mode, messages) => set((state) => ({
        messagesByMode: {
          ...state.messagesByMode,
          [mode]: messages
        }
      })),
      
      toggleLocalPersistence: () => set((state) => ({ persistLocally: !state.persistLocally })),
      toggleWebSearchButton: () => set((state) => {
        const newShow = !state.showWebSearchButton;
        return { 
          showWebSearchButton: newShow,
          useCustomWebSearch: newShow ? false : state.useCustomWebSearch
        };
      }),
      toggleCustomWebSearch: () => set((state) => {
        const newUse = !state.useCustomWebSearch;
        return {
          useCustomWebSearch: newUse,
          showWebSearchButton: newUse ? false : state.showWebSearchButton
        };
      }),
      
      clearHistory: (mode) => set((state) => {
        if (mode) {
          return {
            messagesByMode: {
              ...state.messagesByMode,
              [mode]: defaultWelcomeMessages[mode]
            }
          };
        }
        return {
          messagesByMode: defaultWelcomeMessages
        };
      }),
    }),
    {
      name: 'ai-tutor-chat-storage-v3',
      // partialize filters the state object before it is saved to localStorage
      partialize: (state) => ({
        // Always persist the user's preference
        persistLocally: state.persistLocally,
        showWebSearchButton: state.showWebSearchButton,
        useCustomWebSearch: state.useCustomWebSearch,
        // Only persist the chat history if they have opted in, 
        // otherwise overwrite the stored data with the default welcome messages
        messagesByMode: state.persistLocally ? state.messagesByMode : defaultWelcomeMessages,
      }),
    }
  )
);
