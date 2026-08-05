import { JarvisAction, ActionResult, AppContext } from './types';
import { openVocabDate } from './learning/vocabActions';
import { startSpeedMathDrill } from './learning/speedMathActions';
import { openMockTestLibrary } from './learning/practiceActions';
import { changeUsername } from './profile/settingsActions';
import { goToDashboard } from './dashboard/navigationActions';
import { navigateAny } from './dashboard/navigateAction';
import { changeTheme } from './ui/themeActions';
import { openSettings } from './ui/settingsActions';
import { openChangelogAction } from './ui/changelogActions';

/**
 * Central registry mapping intent names to their handler functions.
 */

import { dashboardActions } from './dashboard/dashboardActions';
import { aiTutorActions } from './learning/aiTutorActions';
import { vocabularyActions } from './learning/vocabularyActions';
import { speedMathActions } from './learning/speedMathActions';
import { practiceLibraryActions } from './learning/practiceLibraryActions';
import { tasksActions } from './tasks/tasksActions';
import { mocksActions } from './mocks/mocksActions';
import { communityActions } from './community/communityActions';
import { systemActions } from './system/systemActions';
import { profileActions } from './profile/settingsActions';

export {
  aiTutorActions,
  vocabularyActions,
  speedMathActions,
  practiceLibraryActions,
  tasksActions,
  mocksActions,
  profileActions,
};

export const allActions: JarvisAction[] = [
  ...dashboardActions,
  ...aiTutorActions,
  ...vocabularyActions,
  ...speedMathActions,
  ...practiceLibraryActions,
  ...tasksActions,
  ...mocksActions,
  ...communityActions,
  ...systemActions,
  ...profileActions,
  openChangelogAction,
];

export const actionRegistry: Record<string, JarvisAction> = {
  [openVocabDate.id]: openVocabDate,
  [startSpeedMathDrill.id]: startSpeedMathDrill,
  [openMockTestLibrary.id]: openMockTestLibrary,
  [changeUsername.id]: changeUsername,
  [goToDashboard.id]: goToDashboard,
  [navigateAny.id]: navigateAny,
  [changeTheme.id]: changeTheme,
  [openSettings.id]: openSettings,
  [openChangelogAction.id]: openChangelogAction,
};

allActions.forEach(action => {
  actionRegistry[action.id] = action;
});

// Utility to create a tiny delay, giving React time to mount components after a route change
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes an action by its registered name. This forms The Execution Loop (Phase 5).
 */
export const executeAction = async (actionId: string, parameters: Record<string, any>, context: AppContext): Promise<ActionResult> => {
  const action = actionRegistry[actionId];
  if (!action) {
    console.warn(`Action not found for intent: ${actionId}`);
    return { success: false, message: `Action ${actionId} not supported yet.` };
  }
  
  try {
    // 1. Check Route & Navigate
    if (action.targetRoute) {
      const target = typeof action.targetRoute === 'function' ? action.targetRoute(parameters) : action.targetRoute;
      
      // Basic check if we are already on the target route. (context.currentPath would be provided by caller)
      if (context.currentPath !== target && context.navigate) {
        console.log(`[Jarvis Execution Loop] Navigating to ${target}`);
        context.navigate(target);
        
        // 2. Wait for Render
        // Give React a tiny delay to ensure the page and refs have mounted
        await wait(150); 
      }
    }

    // 3. Attempt Primary (Pattern 2)
    console.log(`[Jarvis Execution Loop] Attempting Primary (Pattern 2) for ${actionId}`);
    const success = await action.execute(parameters, context);
    
    let feedback = '';
    if (action.feedbackMessage) {
        feedback = typeof action.feedbackMessage === 'function' ? action.feedbackMessage(parameters) : action.feedbackMessage;
    }

    if (success) {
      console.log(`[Jarvis Execution Loop] Feedback: ${feedback}`);
      return { success: true, message: feedback || `Action ${actionId} executed successfully.` };
    }
    
    // 4. Attempt Fallback (Pattern 1)
    if (action.fallback) {
      console.log(`[Jarvis Execution Loop] Primary failed, attempting Fallback (Pattern 1) for ${actionId}`);
      const fallbackSuccess = await action.fallback(parameters);
      if (fallbackSuccess) {
        console.log(`[Jarvis Execution Loop] Feedback: ${feedback}`);
        return { success: true, message: feedback || `Action ${actionId} executed successfully via fallback.` };
      }
    }
    
    return { success: false, message: `Action ${actionId} failed on both Primary and Fallback.` };
  } catch (error: any) {
    console.error(`[Jarvis Execution Loop] Error executing action ${actionId}:`, error);
    return { success: false, message: `Failed to execute ${actionId}: ${error.message}` };
  }
};
