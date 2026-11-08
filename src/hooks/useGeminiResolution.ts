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
        const lookupKey = (featureKey as string) === 'mock_exam_generator'
          ? 'mock_score_extractor'
          : (featureKey as string) === 'flashcards'
          ? 'vocab_extractor'
          : featureKey;

        const subTabKey = lookupKey === 'ai_tutor'
          ? 'ai'
          : lookupKey === 'mock_score_extractor'
          ? 'mock'
          : lookupKey === 'vocab_extractor'
          ? 'vocab'
          : lookupKey === 'ypt_screenshot_parser'
          ? 'ypt'
          : lookupKey;

        // Strictly check feature-specific model choice; never leak global learning page model
        const savedSubModel =
          localStorage.getItem(`geminiModel_${lookupKey}`) ||
          localStorage.getItem(`geminiModel_${subTabKey}`);
        
        setSubModel(savedSubModel || null);
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

  const lookupKey = (featureKey as string) === 'mock_exam_generator'
    ? 'mock_score_extractor'
    : (featureKey as string) === 'flashcards'
    ? 'vocab_extractor'
    : featureKey;

  const featureConfig = globalConfig?.features?.[lookupKey] || globalConfig?.features?.[featureKey];

  const defaultModel = featureConfig?.defaultModel || 'gemini-3.5-flash-lite';

  const isFeatureAllowed = userHasPersonalKey || Boolean(featureConfig?.enabled);

  // Model locking logic:
  // - If user has personal key: locked only if featureConfig.lockForKeyUsers is checked
  // - If user is using global key: locked if featureConfig.lockForNonKeyUsers is checked (defaults to true if undefined)
  const isModelLocked = userHasPersonalKey
    ? Boolean(featureConfig?.lockForKeyUsers)
    : featureConfig?.lockForNonKeyUsers !== false && Boolean(featureConfig?.enabled);

  // Strictly use defaultModel from admin matrix if locked, or if no feature-specific override exists
  const activeModel = isModelLocked
    ? defaultModel
    : (subModel || defaultModel);

  return {
    isFeatureAllowed,
    isModelLocked,
    activeModel,
    userHasPersonalKey,
    effectiveKeyType: userHasPersonalKey ? 'personal' : 'global',
    globalConfig,
  };
}
