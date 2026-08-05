export const domUtils = {
  /**
   * Simulates a user click on an element by its CSS selector.
   */
  simulateClick: (selector: string): boolean => {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) {
      console.warn(`[domUtils] Element not found for click: ${selector}`);
      return false;
    }
    
    try {
      // Dispatch full mouse sequence for better compatibility with complex UI components
      const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
      const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      
      element.dispatchEvent(mousedown);
      element.dispatchEvent(mouseup);
      element.dispatchEvent(click);
      
      return true;
    } catch (e) {
      console.error(`[domUtils] Error simulating click on ${selector}:`, e);
      return false;
    }
  },

  /**
   * Simulates typing into an input or textarea element.
   * Uses native value setters to bypass React's event pooling/wrappers.
   */
  simulateType: (selector: string, text: string): boolean => {
    const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    if (!element) {
      console.warn(`[domUtils] Element not found for typing: ${selector}`);
      return false;
    }
    
    try {
      element.focus();
      
      // React 16+ tracks input values via a hidden property on the native node.
      // We must bypass it by calling the native setter directly.
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;

      const setter = element instanceof HTMLTextAreaElement ? nativeTextAreaValueSetter : nativeInputValueSetter;
      
      if (setter) {
        setter.call(element, text);
      } else {
        element.value = text;
      }
      
      // Dispatch input and change events so React picks up the change
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      return true;
    } catch (e) {
      console.error(`[domUtils] Error simulating typing on ${selector}:`, e);
      return false;
    }
  },

  /**
   * Waits for an element to appear in the DOM before resolving.
   * Useful when waiting for modals to open or animations to finish.
   */
  waitForElement: (selector: string, timeout: number = 5000): Promise<HTMLElement | null> => {
    return new Promise((resolve) => {
      // Check immediately
      let element = document.querySelector(selector) as HTMLElement;
      if (element) {
        return resolve(element);
      }

      // Setup MutationObserver to watch for DOM changes
      const observer = new MutationObserver(() => {
        element = document.querySelector(selector) as HTMLElement;
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Timeout fallback
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  },

  /**
   * Scrapes tagged elements in the active DOM (data-jarvis-*) 
   * to collect visible sections, stats, active questions, and items.
   */
  scrapeJarvisDomData: () => {
    if (typeof document === 'undefined') {
      return { sections: [], stats: {}, activeQuestion: null, items: [] };
    }

    const isElementVisible = (el: Element): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      return true;
    };

    const sections: string[] = [];
    document.querySelectorAll('[data-jarvis-section]').forEach((el) => {
      if (!isElementVisible(el)) return;
      const sec = el.getAttribute('data-jarvis-section');
      if (sec && !sections.includes(sec)) sections.push(sec);
    });

    const stats: Record<string, string> = {};
    document.querySelectorAll('[data-jarvis-stat]').forEach((el) => {
      if (!isElementVisible(el)) return;
      const raw = el.getAttribute('data-jarvis-stat');
      if (raw) {
        const [k, v] = raw.split(':').map((s) => s.trim());
        if (k && v) stats[k] = v;
      }
    });

    let activeQuestion: any = null;
    const qEl = document.querySelector('[data-jarvis-question-id]');
    if (qEl && isElementVisible(qEl)) {
      activeQuestion = {
        id: qEl.getAttribute('data-jarvis-question-id') || 'q_active',
        subject: qEl.getAttribute('data-jarvis-subject') || 'General',
        topic: qEl.getAttribute('data-jarvis-topic') || 'Practice',
        status: qEl.getAttribute('data-jarvis-status') || 'active',
        userAnswer: qEl.getAttribute('data-jarvis-user-answer') || undefined,
        correctAnswer: qEl.getAttribute('data-jarvis-correct-answer') || undefined,
        text: qEl.textContent?.trim().slice(0, 150),
      };
    }

    const items: string[] = [];
    document.querySelectorAll('[data-jarvis-item]').forEach((el) => {
      if (!isElementVisible(el)) return;
      const itemVal = el.getAttribute('data-jarvis-item') || el.textContent?.trim();
      if (itemVal && !items.includes(itemVal)) items.push(itemVal.slice(0, 250));
    });

    return {
      sections,
      stats,
      activeQuestion,
      items,
    };
  }
};

