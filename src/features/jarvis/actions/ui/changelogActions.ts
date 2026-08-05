import { JarvisAction } from '../types';
import { jarvisEventBus } from '../../utils/eventBus';

export const openChangelogAction: JarvisAction = {
  id: 'OPEN_CHANGELOG',
  description: 'Opens the application changelog, release notes, or version update log modal',
  requiredParams: [],
  optionalParams: [],
  feedbackMessage: () => 'Opening release notes and changelog...',
  execute: async () => {
    jarvisEventBus.dispatch({ type: 'OPEN_CHANGELOG' });
    return true;
  }
};
