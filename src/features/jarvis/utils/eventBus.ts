export type JarvisActionType = 'NAVIGATE' | 'SUB_NAVIGATE' | 'CHANGE_THEME' | 'OPEN_SETTINGS' | 'OPEN_CHANGELOG' | 'EXECUTE_INTENT' | 'DISPATCH_INTENT' | 'ACTION_RESULT';

export interface JarvisActionEvent {
  type: JarvisActionType;
  payload?: any;
  intent?: string;
  query?: string;
  operation?: string;
  success?: boolean;
  message?: string;
}

export const jarvisEventBus = {
  dispatch: (action: JarvisActionEvent) => {
    const event = new CustomEvent('jarvis:action', { detail: action });
    window.dispatchEvent(event);
  },
  emit: (action: JarvisActionEvent) => {
    const event = new CustomEvent('jarvis:action', { detail: action });
    window.dispatchEvent(event);
  },
  subscribe: (callback: (action: JarvisActionEvent) => void) => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<JarvisActionEvent>;
      callback(customEvent.detail);
    };
    window.addEventListener('jarvis:action', listener);
    return () => {
      window.removeEventListener('jarvis:action', listener);
    };
  }
};
