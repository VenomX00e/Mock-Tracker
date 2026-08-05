import { create } from 'zustand';
import { JarvisStore } from '../types';

export const useJarvisStore = create<JarvisStore>((set) => ({
  isOpen: false,
  isListening: false,
  isThinking: false,
  navigationNotice: null,
  messages: [],
  mode: 'text',

  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setListening: (isListening) => set({ isListening }),
  setThinking: (isThinking) => set({ isThinking }),
  setNavigationNotice: (navigationNotice) => set({ navigationNotice }),
  setMode: (mode) => set({ mode }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
}));
