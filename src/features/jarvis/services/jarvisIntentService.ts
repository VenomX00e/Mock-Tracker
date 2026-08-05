
import { JarvisCommand } from '../actions/types';
import { getActiveApiKey } from '../../../utils/apiKeyManager';
import { GoogleGenAI, Type, Schema, FunctionDeclaration } from '@google/genai';
import { actionRegistry } from '../actions';
import { JarvisPageContext } from '../types/contextTypes';
import { formatContextForPrompt } from './jarvisContextService';

function buildParamSchema(p: string): Schema {
  switch (p) {
    case 'options':
      return {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'List of option strings for the poll'
      };
    case 'isMulti':
      return {
        type: Type.BOOLEAN,
        description: 'Whether multiple options can be selected'
      };
    case 'optionIndex':
      return {
        type: Type.NUMBER,
        description: 'Index of the option to vote for'
      };
    case 'newName':
      return {
        type: Type.STRING,
        description: "New display name for the user profile"
      };
    case 'exam':
    case 'targetExam':
      return {
        type: Type.STRING,
        description: "Targeted exam name (e.g. 'CAT 2026', 'SBI PO', 'IPMAT')"
      };
    case 'section':
    case 'category':
      return {
        type: Type.STRING,
        description: "Exam section / sector / category name (e.g. 'SSC', 'Banking', 'Railways', 'Insurance')"
      };
    case 'mode':
      return {
        type: Type.STRING,
        description: "Light or dark mode preference ('light' | 'dark')"
      };
    case 'color':
    case 'accentColor':
      return {
        type: Type.STRING,
        description: "Color palette theme name ('blue' | 'emerald' | 'purple' | 'rose' | 'amber' | 'spiderman')"
      };
    case 'theme':
      return {
        type: Type.STRING,
        description: "Theme or mode name (e.g. 'dark', 'light', 'blue', 'spiderman')"
      };
    case 'categoryId':
      return {
        type: Type.STRING,
        description: "Category ID associated with targeted exam"
      };
    case 'bio':
    case 'studyGoal':
    case 'goal':
      return {
        type: Type.STRING,
        description: "User study goal or bio text"
      };
    case 'avatarUrl':
    case 'avatar':
    case 'avatarId':
      return {
        type: Type.STRING,
        description: "Profile avatar URL or predefined avatar icon identifier"
      };
    default:
      return { type: Type.STRING };
  }
}

export async function determineIntent(
  userInput: string,
  context?: JarvisPageContext,
  model: string = 'gemini-3.5-flash'
): Promise<JarvisCommand | null> {
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    throw new Error("Jarvis offline: Missing API Key.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const functionDeclarations: FunctionDeclaration[] = Object.values(actionRegistry).map(action => {
    const properties: Record<string, Schema> = {};
    
    // Add required params
    action.requiredParams.forEach(p => {
      properties[p] = buildParamSchema(p);
    });
    
    // Add optional params
    if (action.optionalParams) {
      action.optionalParams.forEach(p => {
        properties[p] = buildParamSchema(p);
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
  
  const contextSnippet = context ? formatContextForPrompt(context) : '';

  const systemInstruction = `You are the Jarvis UI Controller for an Exam Prep Application.
${contextSnippet}

Guidelines:
1. Use the [CURRENT SCREEN CONTEXT] to understand what the user is looking at.
2. Call function tools ONLY when the user explicitly requests a UI action (e.g., "go to dashboard", "open settings", "change theme to dark", "create task", "start math drill").
3. CRITICAL EXCEPTION: Do NOT call any function tool if the user is asking an informational, analytical, performance evaluation, data inquiry, or screen summary question (e.g., "Who is in the top of the leaderboard?", "Who is rank 1?", "How did I do on my last mock?", "What am I looking at?", "Can you summarize what I am looking at right now?", "How are my scores?", "Summarize my performance", "Explain this section"). For these queries, DO NOT invoke any tool or function call so that Jarvis can answer using the full screen context.
4. For queries about release notes, what's new, changelog, or version updates, invoke OPEN_CHANGELOG or NAVIGATE to 'changelog'.`;

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
