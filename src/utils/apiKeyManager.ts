export interface ApiKeyEntry {
  id: string;
  key: string;
  isActive: boolean;
}

export const cleanApiKey = (key: string): string => {
  if (!key) return '';
  return key.replace(/^["']|["']$/g, '').trim();
};

export const getApiKeys = (): ApiKeyEntry[] => {
  if (typeof window === 'undefined') return [];
  
  // 1. Check for new format
  const storedList = localStorage.getItem('geminiApiKeysList');
  if (storedList) {
    try {
      const parsed: ApiKeyEntry[] = JSON.parse(storedList);
      return parsed.map(k => ({ ...k, key: cleanApiKey(k.key) }));
    } catch (e) {
      console.error("Failed to parse geminiApiKeysList", e);
    }
  }

  // 2. Migration: Check for legacy format
  const legacyKey = localStorage.getItem('geminiApiKey');
  if (legacyKey) {
    const cleaned = cleanApiKey(legacyKey);
    if (cleaned) {
      const migratedList: ApiKeyEntry[] = [
        {
          id: Date.now().toString(),
          key: cleaned,
          isActive: true,
        }
      ];
      localStorage.setItem('geminiApiKeysList', JSON.stringify(migratedList));
      return migratedList;
    }
  }

  return [];
};

export const saveApiKeys = (keys: ApiKeyEntry[]) => {
  if (typeof window === 'undefined') return;
  const cleanedKeys = keys.map(k => ({ ...k, key: cleanApiKey(k.key) }));
  localStorage.setItem('geminiApiKeysList', JSON.stringify(cleanedKeys));
  
  const activeKeys = cleanedKeys.filter(k => k.isActive && k.key.length > 0);
  if (activeKeys.length > 0) {
    localStorage.setItem('geminiApiKey', activeKeys[activeKeys.length - 1].key);
  } else {
    localStorage.removeItem('geminiApiKey');
  }

  window.dispatchEvent(new CustomEvent('gemini_keys_changed'));
};

export const getActiveApiKey = (): string | null => {
  if (typeof window === 'undefined') return null;
  const keys = getApiKeys();
  const activeKeys = keys.filter(k => k.isActive && k.key && k.key.trim().length > 0);
  
  if (activeKeys.length > 0) {
    // Return the latest active key deterministically
    return cleanApiKey(activeKeys[activeKeys.length - 1].key);
  }
  
  // Fallback to legacy just in case
  const legacyKey = localStorage.getItem('geminiApiKey');
  if (legacyKey) {
    const cleaned = cleanApiKey(legacyKey);
    if (cleaned) return cleaned;
  }

  return null;
};
