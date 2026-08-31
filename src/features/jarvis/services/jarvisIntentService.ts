
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
  _model: string = 'gemini-3.5-flash'
): Promise<JarvisCommand | null> {
  const customApiKey = getActiveApiKey();
  
  const tools = Object.values(actionRegistry).map(action => ({
    name: action.id,
    description: action.description,
    requiredParams: action.requiredParams || [],
    optionalParams: action.optionalParams || []
  }));

  try {
    const response = await fetch('/api/jarvis/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userInput,
        context,
        tools,
        customApiKey: customApiKey || null,
        featureKey: 'jarvis'
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.intent || null;
  } catch (error) {
    console.error('Error determining intent via server proxy:', error);
    return null;
  }
}
