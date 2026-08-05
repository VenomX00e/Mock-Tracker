export type MessageRole = 'user' | 'assistant';
export type JarvisMode = 'text' | 'voice';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface JarvisState {
  isOpen: boolean;
  isListening: boolean;
  isThinking: boolean;
  navigationNotice?: string | null;
  messages: Message[];
  mode: JarvisMode;
}

export interface JarvisActions {
  toggleOpen: () => void;
  setListening: (isListening: boolean) => void;
  setThinking: (isThinking: boolean) => void;
  setNavigationNotice: (notice: string | null) => void;
  setMode: (mode: JarvisMode) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
}

export type JarvisStore = JarvisState & JarvisActions;
