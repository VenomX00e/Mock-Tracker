import { JarvisAction } from '../types';
import { jarvisEventBus } from '../../utils/eventBus';

export const askAiTutor: JarvisAction = {
  id: 'ASK_AI_TUTOR',
  description: 'Ask the AI Tutor a question or open the AI Tutor tab with a topic or query.',
  requiredParams: [],
  optionalParams: ['query', 'topic'],
  targetRoute: 'learning?tab=ai-tutor',
  feedbackMessage: (params) => {
    if (params.query) return `Asking AI Tutor: "${params.query}"`;
    if (params.topic) return `Opening AI Tutor for ${params.topic}.`;
    return `Opening AI Tutor.`;
  },
  execute: async (params, context) => {
    jarvisEventBus.emit({
      type: 'EXECUTE_INTENT',
      intent: 'ASK_AI_TUTOR',
      payload: {
        query: params.query,
        topic: params.topic
      }
    });
    return true;
  }
};

// 2.1 AI Tutor Actions
export const aiTutorActions: JarvisAction[] = [
  askAiTutor,
];

