import { useState, useEffect } from 'react';
import { useUserProfileCtx } from '../context/AppContext';
import { GlobalGeminiSystemConfig } from '../types';
import {
  subscribeGlobalGeminiConfig,
  DEFAULT_GLOBAL_GEMINI_CONFIG,
} from '../services/globalGeminiService';
import { getActiveApiKey } from '../utils/apiKeyManager';

export type FeatureKey = keyof GlobalGeminiSystemConfig['features'];

export interface GeminiResolutionResult {
  isFeatureAllowed: boolean;
  isModelLocked: boolean;
  activeModel: string;
  userHasPersonalKey: boolean;
  effectiveKeyType: 'personal' | 'global';
  globalConfig: GlobalGeminiSystemConfig;
}

export function useGeminiResolution(featureKey: FeatureKey): GeminiResolutionResult {
  let profile: any = null;
  try {
    const userProfileCtx = useUserProfileCtx();
    profile = userProfileCtx?.profile;
  } catch (e) {
    // Graceful fallback if invoked outside UserProfileCtx
    profile = null;
  }

  const [globalConfig, setGlobalConfig] = useState<GlobalGeminiSystemConfig>(DEFAULT_GLOBAL_GEMINI_CONFIG);
  const [localKey, setLocalKey] = useState<string | null>(getActiveApiKey());
  const [subModel, setSubModel] = useState<string | null>(null);

  useEffect(() => {
    const syncState = () => {
      setLocalKey(getActiveApiKey());
      if (typeof window !== 'undefined') {
        const subTabKey = featureKey === 'ai_tutor' ? 'ai' : featureKey;
        const savedSubModel = localStorage.getItem(`geminiModel_${subTabKey}`);
        const savedGlobalModel = localStorage.getItem('geminiModel');
        setSubModel(savedSubModel || savedGlobalModel);
      }
    };

    syncState();

    window.addEventListener('gemini_keys_changed', syncState);
    window.addEventListener('storage', syncState);

    return () => {
      window.removeEventListener('gemini_keys_changed', syncState);
      window.removeEventListener('storage', syncState);
    };
  }, [featureKey]);

  useEffect(() => {
    const unsubscribe = subscribeGlobalGeminiConfig((cfg) => {
      setGlobalConfig(cfg);
    });
    return () => unsubscribe();
  }, []);

  const userHasPersonalKey = Boolean(
    profile?.geminiApiKey || (localKey && localKey.trim().length > 0)
  );

  const featureConfig = globalConfig?.features?.[featureKey];

  const isFeatureAllowed = userHasPersonalKey || Boolean(featureConfig?.enabled);

  // If user has personal key -> user can choose model freely per subpage.
  // If using global key -> model is locked to owner's featureConfig.defaultModel.
  const storedPreferredModel = typeof window !== 'undefined' ? localStorage.getItem('preferredModel') : null;
  const activeModel = userHasPersonalKey
    ? (subModel || profile?.preferredModel || storedPreferredModel || 'gemini-2.5-flash-lite')
    : (featureConfig?.defaultModel || 'gemini-2.5-flash-lite');

  const isModelLocked = !userHasPersonalKey && Boolean(featureConfig?.enabled);

  return {
    isFeatureAllowed,
    isModelLocked,
    activeModel,
    userHasPersonalKey,
    effectiveKeyType: userHasPersonalKey ? 'personal' : 'global',
    globalConfig,
  };
}
