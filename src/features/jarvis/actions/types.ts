import { JarvisPageContext } from '../types/contextTypes';

export interface AppContext {
  navigate?: (path: string) => void;
  currentPath?: string;
  pageContext?: JarvisPageContext;
  [key: string]: any; 
}

export interface JarvisAction {
  id: string;                    // e.g., "OPEN_VOCAB_DATE"
  description: string;           // Tell Gemini what this action does
  requiredParams: string[];
  optionalParams?: string[];      // e.g., ["date"]
  targetRoute?: string | ((params: any) => string); // Check Route: Am I on the right page?
  feedbackMessage?: string | ((params: any) => string); // Feedback: Jarvis voice/text responds
  execute: (params: any, context: AppContext) => Promise<boolean>; // Primary State/Router logic
  fallback?: (params: any) => Promise<boolean>;                    // DOM manipulation fallback
}

export interface JarvisCommand {
  action: string;
  parameters: Record<string, any>;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}
