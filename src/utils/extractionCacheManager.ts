import { ExtractionSession } from '../types/extraction';

const CACHE_KEY = 'ypt_editorial_extraction_session';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours TTL

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export class ExtractionCacheManager {
  /**
   * Saves the current extraction session to localStorage with debouncing.
   * Debouncing avoids excessive disk/storage writes during frequent text edits.
   */
  public static saveSession(session: ExtractionSession, debounceMs: number = 400): void {
    if (typeof window === 'undefined') return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      ExtractionCacheManager.saveSessionImmediate(session);
      debounceTimer = null;
    }, debounceMs);
  }

  /**
   * Immediately saves the extraction session synchronously to localStorage.
   * Useful for step transitions, API response reception, or modal unmount.
   */
  public static saveSessionImmediate(session: ExtractionSession): void {
    if (typeof window === 'undefined') return;

    try {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      const payload: ExtractionSession = {
        ...session,
        lastUpdated: Date.now(),
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[ExtractionCacheManager] Failed to save session to localStorage:', err);
    }
  }

  /**
   * Loads the cached session from localStorage.
   * Checks for 24-hour expiration TTL and validates basic schema integrity.
   * If expired or corrupted, it clears the cache and returns null.
   */
  public static loadSession(maxAgeMs: number = DEFAULT_TTL_MS): ExtractionSession | null {
    if (typeof window === 'undefined') return null;

    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw) as ExtractionSession;

      // Validate basic structure
      if (!session || !session.sourceType || typeof session.currentStep !== 'number') {
        ExtractionCacheManager.clearSession();
        return null;
      }

      // Check TTL (24 Hours)
      const age = Date.now() - (session.lastUpdated || 0);
      if (age > maxAgeMs || age < 0) {
        ExtractionCacheManager.clearSession();
        return null;
      }

      return session;
    } catch (err) {
      console.warn('[ExtractionCacheManager] Error parsing cached session, clearing:', err);
      ExtractionCacheManager.clearSession();
      return null;
    }
  }

  /**
   * Clears the active extraction session and cancels any pending debounce timers.
   * Called on Step 4 completion (commit) or explicit user reset.
   */
  public static clearSession(): void {
    if (typeof window === 'undefined') return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (err) {
      console.warn('[ExtractionCacheManager] Failed to clear session:', err);
    }
  }

  /**
   * Checks whether a valid, non-expired session exists in storage without full parse.
   */
  public static hasSavedSession(maxAgeMs: number = DEFAULT_TTL_MS): boolean {
    const session = ExtractionCacheManager.loadSession(maxAgeMs);
    return session !== null;
  }

  /**
   * Retrieves a quick summary of the stored session (useful for UI prompts/badges).
   */
  public static getSessionSummary(): {
    sourceType: ExtractionSession['sourceType'];
    title?: string;
    step: 1 | 2 | 3 | 4;
    ageMs: number;
    hasAiOutput: boolean;
  } | null {
    const session = ExtractionCacheManager.loadSession();
    if (!session) return null;

    return {
      sourceType: session.sourceType,
      title: session.sourceMetadata?.title || session.sourceMetadata?.fileName || 'Untitled extraction',
      step: session.currentStep,
      ageMs: Date.now() - session.lastUpdated,
      hasAiOutput: Boolean(session.aiOutput && session.aiOutput.words?.length > 0),
    };
  }
}
