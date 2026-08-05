import { JarvisAction } from '../types';
import { domUtils } from '../../domUtils';
import { jarvisEventBus } from '../../utils/eventBus';

export const openVocabDate: JarvisAction = {
  id: 'OPEN_EDITORIAL_VOCAB',
  description: 'Opens the vocabulary canvas for a specific date or title',
  requiredParams: ['query'],
  targetRoute: 'learning?tab=vocabulary',
  feedbackMessage: (params) => `Opening vocabulary canvas for ${params.query}.`,
  execute: async (params, context) => {
    console.log(`Executing openVocabDate primary logic for: ${params.query}`);
    
    if (!params.query) {
      throw new Error("Please specify a date or title.");
    }

    // Primary Execution (Pattern 2): Trigger through Event Bus
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'OPEN_VOCAB_CANVAS',
      query: params.query
    });
    
    return true;
  },
  fallback: async (params) => {
    if (!params.query) return false;
    // Fallback (Pattern 1)
    console.log("Attempting fallback DOM clicks for vocab...");
    // Fallback can just look for elements containing the text and click it
    // But since it's hard to do a text search with querySelector, we try to use a specific attribute if possible,
    // or we'll just return false here for simplicity if it fails.
    
    // Try to find any div that has data-canvas-id and text content matching the query
    const els = Array.from(document.querySelectorAll('[data-canvas-id]'));
    const target = els.find(el => el.textContent?.toLowerCase().includes(params.query.toLowerCase()));
    
    if (target) { 
       target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
       return true;
    }
    
    return false;
  }
};
