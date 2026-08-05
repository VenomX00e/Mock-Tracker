import { JarvisAction } from '../types';
import { jarvisEventBus } from '../../utils/eventBus';

export const openAddMockScoreAction: JarvisAction = {
  id: 'OPEN_ADD_MOCK_SCORE',
  description: 'Navigates to the Add Mock Score page to log mock exam performance or upload scorecards',
  requiredParams: [],
  targetRoute: 'add-mock',
  feedbackMessage: () => 'Opening Add Mock Score page.',
  execute: async (params, context) => {
    if (context?.navigate) {
      context.navigate('add-mock');
    } else {
      jarvisEventBus.dispatch({ type: 'NAVIGATE', payload: 'add-mock' });
    }
    return true;
  },
};

export const addMockScoreAction: JarvisAction = {
  id: 'ADD_MOCK_SCORE',
  description: 'Navigates to the Add Mock Score form to enter a new mock score',
  requiredParams: [],
  targetRoute: 'add-mock',
  feedbackMessage: () => 'Opening Add Mock Score form.',
  execute: async (params, context) => {
    if (context?.navigate) {
      context.navigate('add-mock');
    } else {
      jarvisEventBus.dispatch({ type: 'NAVIGATE', payload: 'add-mock' });
    }
    return true;
  },
};

export const mocksActions: JarvisAction[] = [
  openAddMockScoreAction,
  addMockScoreAction,
];
