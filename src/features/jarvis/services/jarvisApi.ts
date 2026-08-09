import { GoogleGenAI, Type } from '@google/genai';
import { getActiveApiKey } from '../../../utils/apiKeyManager';
import { JARVIS_SYSTEM_PROMPT } from '../constants/prompts';
import { Message } from '../types';
import { jarvisEventBus } from '../utils/eventBus';
import { JarvisPageContext } from '../types/contextTypes';
import { getCurrentPageContext, buildJarvisFullSystemPrompt, formatContextForPrompt } from './jarvisContextService';

export const jarvisApi = {
  /**
   * Sends a message to the Gemini API and streams the response back.
   * Uses the locally configured user API key.
   */
  async sendMessageStream(
    messages: Message[],
    onUpdate: (text: string) => void,
    context?: JarvisPageContext
  ): Promise<string> {
    const customApiKey = getActiveApiKey();
    const activeContext = context || getCurrentPageContext();

    try {
      const response = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          context: activeContext,
          customApiKey: customApiKey || null,
          featureKey: 'jarvis'
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get response from Jarvis');
      }

      const data = await response.json();
      const text = data.text || '';
      onUpdate(text);

      // Execute function calls if any return from backend
      if (data.functionCalls && Array.isArray(data.functionCalls)) {
        for (const call of data.functionCalls) {
          if (call.name === 'appAction' && call.args) {
            const actionType = call.args.type;
            const finalPayload = (actionType === 'DISPATCH_INTENT' || actionType === 'CHANGE_THEME')
              ? (call.args.parameters || call.args.payload) 
              : call.args.payload;
            
            jarvisEventBus.dispatch({ 
               type: actionType, 
               payload: finalPayload,
               intent: call.args.intent
            } as any);
          }
        }
      }

      return text;
    } catch (error: any) {
      console.error("Jarvis API Error:", error);
      throw new Error(error.message || "An error occurred while communicating with Jarvis.");
    }
  },
};
