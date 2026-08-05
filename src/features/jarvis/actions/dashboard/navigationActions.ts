import { JarvisAction } from '../types';

export const goToDashboard: JarvisAction = {
  id: 'GO_TO_DASHBOARD',
  description: 'Navigates to the user dashboard',
  requiredParams: [],
  targetRoute: '/dashboard',
  feedbackMessage: () => `Going to your dashboard.`,
  execute: async (params, context) => {
    console.log('Executing goToDashboard');
    // Navigation is handled automatically by the execution loop because of targetRoute
    return true;
  }
};
