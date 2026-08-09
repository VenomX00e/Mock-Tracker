import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { GlobalGeminiSystemConfig } from '../types';

export const DEFAULT_GLOBAL_GEMINI_CONFIG: GlobalGeminiSystemConfig = {
  features: {
    ypt_screenshot_parser: { enabled: true, defaultModel: 'gemini-2.5-flash', allowCustomKeyOverride: true },
    ai_tutor: { enabled: false, defaultModel: 'gemini-2.5-flash', allowCustomKeyOverride: true },
    jarvis: { enabled: false, defaultModel: 'gemini-2.5-flash', allowCustomKeyOverride: true },
    mock_exam_generator: { enabled: false, defaultModel: 'gemini-2.5-flash', allowCustomKeyOverride: true },
    flashcards: { enabled: false, defaultModel: 'gemini-2.5-flash', allowCustomKeyOverride: true },
    general_chat: { enabled: false, defaultModel: 'gemini-2.5-flash', allowCustomKeyOverride: true },
  },
  updatedAt: Date.now(),
  updatedBy: 'system',
};

export const GLOBAL_GEMINI_DOC_REF = doc(db, 'system_config', 'global_gemini');

export async function getGlobalGeminiConfig(): Promise<GlobalGeminiSystemConfig> {
  try {
    const snap = await getDoc(GLOBAL_GEMINI_DOC_REF);
    if (snap.exists()) {
      return snap.data() as GlobalGeminiSystemConfig;
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
        callback(snap.data() as GlobalGeminiSystemConfig);
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
