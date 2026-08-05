const fs = require('fs');
let code = fs.readFileSync('src/features/jarvis/services/jarvisIntentService.ts', 'utf8');

code = `
import { JarvisCommand } from '../actions/types';
import { getActiveApiKey } from '../../../utils/apiKeyManager';
import { GoogleGenAI, Type, Schema, FunctionDeclaration } from '@google/genai';
import { actionRegistry } from '../actions';

export async function determineIntent(userInput: string, model: string = 'gemini-3.5-flash'): Promise<JarvisCommand | null> {
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    throw new Error("Jarvis offline: Missing API Key.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const functionDeclarations: FunctionDeclaration[] = Object.values(actionRegistry).map(action => {
    const properties: Record<string, Schema> = {};
    
    // Add required params
    action.requiredParams.forEach(p => {
      properties[p] = { type: Type.STRING };
    });
    
    // Add optional params
    if (action.optionalParams) {
      action.optionalParams.forEach(p => {
        properties[p] = { type: Type.STRING };
      });
    }

    return {
      name: action.id,
      description: action.description,
      parameters: {
        type: Type.OBJECT,
        properties: Object.keys(properties).length > 0 ? properties : undefined,
        required: action.requiredParams.length > 0 ? action.requiredParams : undefined
      }
    };
  });
  
  const systemInstruction = "You are the Jarvis UI Controller. The user will ask you to do something. Call the appropriate function to fulfill the user's intent.";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: userInput,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations }],
        temperature: 0.1
      }
    });

    const call = response.functionCalls?.[0];
    if (call) {
      return {
        action: call.name,
        parameters: call.args as Record<string, any>
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error determining intent:', error);
    return null;
  }
}
`;

fs.writeFileSync('src/features/jarvis/services/jarvisIntentService.ts', code);
console.log("Patched jarvisIntentService.ts to use function calling");
