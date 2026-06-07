export interface ApiKeyEntry {
  id: string;
  key: string;
  isActive: boolean;
}

export const getApiKeys = (): ApiKeyEntry[] => {
  if (typeof window === 'undefined') return [];
  
  // 1. Check for new format
  const storedList = localStorage.getItem('geminiApiKeysList');
  if (storedList) {
    try {
      return JSON.parse(storedList);
    } catch (e) {
      console.error("Failed to parse geminiApiKeysList", e);
    }
  }

  // 2. Migration: Check for legacy format
  const legacyKey = localStorage.getItem('geminiApiKey');
  if (legacyKey) {
    const migratedList: ApiKeyEntry[] = [
      {
        id: Date.now().toString(),
        key: legacyKey.trim(),
        isActive: true,
      }
    ];
    // Save to new format
    localStorage.setItem('geminiApiKeysList', JSON.stringify(migratedList));
    // Kept legacy key in localStorage so that other components don't break immediately
    // during this transitional migration step.
    return migratedList;
  }

  return [];
};

export const saveApiKeys = (keys: ApiKeyEntry[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('geminiApiKeysList', JSON.stringify(keys));
  
  // Keep the legacy key updated with the first active key so older code still works 
  // during the transition until we rewrite all service files to use getActiveApiKey()
  const activeKeys = keys.filter(k => k.isActive);
  if (activeKeys.length > 0) {
    localStorage.setItem('geminiApiKey', activeKeys[0].key);
  } else {
    localStorage.removeItem('geminiApiKey');
  }
};

export const getActiveApiKey = (): string | null => {
  if (typeof window === 'undefined') return null;
  const keys = getApiKeys();
  const activeKeys = keys.filter(k => k.isActive);
  
  if (activeKeys.length > 0) {
    // Return a random active key to load-balance across multiple keys
    const randomIndex = Math.floor(Math.random() * activeKeys.length);
    return activeKeys[randomIndex].key;
  }
  
  // Fallback to legacy just in case
  const legacyKey = localStorage.getItem('geminiApiKey');
  if (legacyKey) return legacyKey;

  return null;
};
