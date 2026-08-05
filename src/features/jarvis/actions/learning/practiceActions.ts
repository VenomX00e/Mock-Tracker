import { JarvisAction } from '../types';
import { jarvisEventBus } from '../../utils/eventBus';

export const openMockTestLibrary: JarvisAction = {
  id: 'OPEN_MOCK_TEST_LIBRARY',
  description: 'Opens the practice library for topic quizzes and practice sets',
  requiredParams: [],
  targetRoute: 'learning/practice',
  feedbackMessage: () => `Opening the practice library.`,
  execute: async (params, context) => {
    console.log('Executing openMockTestLibrary');
    return true; // The navigation handles opening the tab
  }
};
