import { JarvisAction } from '../types';
import { jarvisEventBus } from '../../utils/eventBus';

export const navigateAny: JarvisAction = {
  id: 'NAVIGATE',
  description: 'Navigates to a specific screen. Valid destinations: "dashboard", "community", "tasks", "profile", "learning/ai", "learning/vocab", "learning/math", "learning/practice", "countdowns", "admin", "changelog", "release-notes".',
  requiredParams: ['destination'],
  feedbackMessage: (params) => `Navigating to ${params.destination}.`,
  execute: async (params, context) => {
    if (!params.destination) {
      throw new Error("I need to know where you want to go.");
    }
    
    // Check if we are already there to avoid double navigation
    const target = params.destination.replace(/^\//, '');
    const current = context.currentPath ? context.currentPath.replace(/^\//, '') : '';
    if (current === target) {
       console.log(`Already on ${target}`);
       return true; 
    }

    // We can just use the provided context.navigate if available, or event bus directly
    if (context.navigate) {
        context.navigate(params.destination);
    } else {
        jarvisEventBus.dispatch({ type: 'NAVIGATE', payload: params.destination });
    }
    return true;
  }
};
