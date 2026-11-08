import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { GlobalGeminiSystemConfig } from '../types';

export const DEFAULT_GLOBAL_GEMINI_CONFIG: GlobalGeminiSystemConfig = {
  features: {
    ypt_screenshot_parser: { enabled: true, defaultModel: 'gemini-3.5-flash-lite', lockForNonKeyUsers: true, lockForKeyUsers: false, allowCustomKeyOverride: true },
    ai_tutor: { enabled: false, defaultModel: 'gemini-3.5-flash-lite', lockForNonKeyUsers: true, lockForKeyUsers: false, allowCustomKeyOverride: true },
    jarvis: { enabled: false, defaultModel: 'gemini-3.5-flash-lite', lockForNonKeyUsers: true, lockForKeyUsers: false, allowCustomKeyOverride: true },
    mock_score_extractor: { enabled: false, defaultModel: 'gemini-3.1-flash-lite', lockForNonKeyUsers: true, lockForKeyUsers: false, allowCustomKeyOverride: true },
    vocab_extractor: { enabled: false, defaultModel: 'gemini-3.5-flash-lite', lockForNonKeyUsers: true, lockForKeyUsers: false, allowCustomKeyOverride: true },
  },
  updatedAt: Date.now(),
  updatedBy: 'system',
};

export const GLOBAL_GEMINI_DOC_REF = doc(db, 'system_config', 'global_gemini');

export function normalizeConfig(raw: any): GlobalGeminiSystemConfig {
  const mergedFeatures: any = { ...DEFAULT_GLOBAL_GEMINI_CONFIG.features };
  if (raw && raw.features) {
    if (!raw.features.mock_score_extractor && raw.features.mock_exam_generator) {
      mergedFeatures.mock_score_extractor = {
        ...raw.features.mock_exam_generator,
        lockForNonKeyUsers: raw.features.mock_exam_generator.lockForNonKeyUsers ?? true,
        lockForKeyUsers: raw.features.mock_exam_generator.lockForKeyUsers ?? false,
      };
    }
    if (!raw.features.vocab_extractor && raw.features.flashcards) {
      mergedFeatures.vocab_extractor = {
        ...raw.features.flashcards,
        lockForNonKeyUsers: raw.features.flashcards.lockForNonKeyUsers ?? true,
        lockForKeyUsers: raw.features.flashcards.lockForKeyUsers ?? false,
      };
    }
    for (const key of Object.keys(mergedFeatures)) {
      if (raw.features[key]) {
        const rawModel = raw.features[key].defaultModel;
        const cleanModel =
          typeof rawModel === 'string' && rawModel.trim()
            ? rawModel.replace(/^google[/:\s-]+/i, '').trim()
            : mergedFeatures[key].defaultModel;
        mergedFeatures[key] = {
          ...mergedFeatures[key],
          ...raw.features[key],
          defaultModel: cleanModel,
          lockForNonKeyUsers: raw.features[key].lockForNonKeyUsers !== undefined ? Boolean(raw.features[key].lockForNonKeyUsers) : true,
          lockForKeyUsers: Boolean(raw.features[key].lockForKeyUsers),
        };
      }
    }
  }
  return {
    features: mergedFeatures,
    updatedAt: raw?.updatedAt || Date.now(),
    updatedBy: raw?.updatedBy || 'system',
  };
}

export async function getGlobalGeminiConfig(): Promise<GlobalGeminiSystemConfig> {
  try {
    const snap = await getDoc(GLOBAL_GEMINI_DOC_REF);
    if (snap.exists()) {
      return normalizeConfig(snap.data());
    }
  } catch (err) {
    console.error('Error reading system_config/global_gemini:', err);
  }
  return DEFAULT_GLOBAL_GEMINI_CONFIG;
}

export function subscribeGlobalGeminiConfig(
  callback: (config: GlobalGeminiSystemConfig) => void
): () => void {
  return onSnapshot(
    GLOBAL_GEMINI_DOC_REF,
    (snap) => {
      if (snap.exists()) {
        callback(normalizeConfig(snap.data()));
      } else {
        callback(DEFAULT_GLOBAL_GEMINI_CONFIG);
      }
    },
    (err) => {
      console.error('Error listening to system_config/global_gemini:', err);
      callback(DEFAULT_GLOBAL_GEMINI_CONFIG);
    }
  );
}

export async function updateGlobalGeminiConfig(
  config: Partial<GlobalGeminiSystemConfig>,
  updatedByUid: string
): Promise<void> {
  const current = await getGlobalGeminiConfig();
  const updatedPayload: GlobalGeminiSystemConfig = {
    ...current,
    ...config,
    features: {
      ...current.features,
      ...(config.features || {}),
    },
    updatedAt: Date.now(),
    updatedBy: updatedByUid,
  };

  await setDoc(GLOBAL_GEMINI_DOC_REF, updatedPayload, { merge: true });
}
