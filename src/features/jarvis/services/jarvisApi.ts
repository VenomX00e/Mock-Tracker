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
    const apiKey = getActiveApiKey();
    if (!apiKey) {
      throw new Error("Jarvis offline: Missing API Key. Please add your Gemini API key in the learning page settings.");
    }

    try {
      const activeContext = context || getCurrentPageContext();
      const baseSystemPrompt = buildJarvisFullSystemPrompt(activeContext);
      const additionalContext = formatContextForPrompt(activeContext);

      const systemInstruction = `${baseSystemPrompt}

${JARVIS_SYSTEM_PROMPT}

${additionalContext}`;

      // Initialize the SDK locally with the user's key
      const ai = new GoogleGenAI({ apiKey });
      
      // Map messages to SDK format
      const formattedMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      // Call the API with streaming
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3.5-flash',
        contents: formattedMessages,
        config: {
          systemInstruction,
          tools: [{
            functionDeclarations: [
              {
                name: 'appAction',
                description: 'Performs an action within the main application (e.g. changing theme, navigating to a page, opening settings).',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      description: 'The type of action to perform: "NAVIGATE", "CHANGE_THEME", "OPEN_SETTINGS", or "DISPATCH_INTENT"',
                    },
                    payload: {
                      type: Type.STRING,
                      description: 'Optional string payload. E.g., for NAVIGATE, valid routes: "home", "dashboard", "community", etc. For CHANGE_THEME fallback, "light", "dark", or "blue".',
                    },
                    intent: {
                      type: Type.STRING,
                      description: 'The specific intent to execute when type is DISPATCH_INTENT. E.g., "UPDATE_PROFILE_NAME" or "START_MATH_DRILL".',
                    },
                    parameters: {
                      type: Type.OBJECT,
                      description: 'JSON object parameters for the action or intent. For CHANGE_THEME: mode ("light" | "dark"), color/accentColor ("blue" | "emerald" | "purple" | "rose" | "amber" | "spiderman"), theme ("fallback string"). For DISPATCH_INTENT: intent-specific params.'
                    }
                  },
                  required: ['type']
                }
              }
            ]
          }]
        }
      });

      let fullResponse = '';

      for await (const chunk of responseStream) {
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          for (const call of chunk.functionCalls) {
            if (call.name === 'appAction' && call.args) {
              const actionType = call.args.type as any;
              
              // Map parameters to payload for DISPATCH_INTENT or CHANGE_THEME, otherwise use payload
              const finalPayload = (actionType === 'DISPATCH_INTENT' || actionType === 'CHANGE_THEME')
                ? (call.args.parameters || call.args.payload) 
                : call.args.payload;
              
              jarvisEventBus.dispatch({ 
                 type: actionType, 
                 payload: finalPayload,
                 intent: call.args.intent
              } as any);

              fullResponse += `\n*Action executed: ${actionType} ${call.args.intent || ''}*`;
              onUpdate(fullResponse);
            }
          }
        }
        
        if (chunk.text) {
          fullResponse += chunk.text;
          onUpdate(fullResponse);
        }
      }

      return fullResponse;
    } catch (error: any) {
      console.error("Jarvis API Error:", error);
      throw new Error(error.message || "An error occurred while communicating with Jarvis.");
    }
  },
};
