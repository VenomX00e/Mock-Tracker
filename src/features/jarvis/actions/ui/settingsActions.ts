import { JarvisAction } from '../types';
import { jarvisEventBus } from '../../utils/eventBus';

export const openSettings: JarvisAction = {
  id: 'OPEN_SETTINGS',
  description: 'Opens the application settings',
  requiredParams: [],
  feedbackMessage: () => `Opening settings.`,
  execute: async () => {
    jarvisEventBus.dispatch({ type: 'OPEN_SETTINGS' });
    return true;
  }
};
