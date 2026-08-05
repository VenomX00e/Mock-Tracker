/**
 * Utility functions for interacting with the DOM when simulating user actions.
 * Used as a fallback (Pattern 1) when Event Bus or State (Pattern 2) isn't sufficient.
 */
export const domUtils = {
  simulateClick: (selector: string): boolean => {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.click();
      return true;
    }
    return false;
  },

  simulateType: (selector: string, text: string): boolean => {
    const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    if (element) {
      element.value = text;
      // Trigger React state updates
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  },

  scrollToElement: (selector: string): boolean => {
    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    }
    return false;
  }
};
