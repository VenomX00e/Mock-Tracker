import { JarvisAction } from '../types';
import { jarvisEventBus } from '../../utils/eventBus';

export const changeTheme: JarvisAction = {
  id: 'CHANGE_THEME',
  description: 'Changes the application theme mode (light/dark) or accent color (blue, emerald, purple, rose, amber, spiderman)',
  requiredParams: [],
  optionalParams: ['theme', 'mode', 'color', 'accentColor'],
  feedbackMessage: (params) => {
    const modeText = params.mode ? `${params.mode} mode` : '';
    const colorText = params.color || params.accentColor ? `${params.color || params.accentColor} accent` : '';
    const combined = [colorText, modeText].filter(Boolean).join(' in ');
    return `Theme updated to ${combined || params.theme || 'selected theme'}.`;
  },
  execute: async (params) => {
    jarvisEventBus.dispatch({
      type: 'CHANGE_THEME',
      payload: {
        mode: params.mode || (['light', 'dark'].includes(params.theme) ? params.theme : undefined),
        color: params.color || params.accentColor || (!['light', 'dark'].includes(params.theme) ? params.theme : undefined)
      }
    });
    return true;
  }
};

