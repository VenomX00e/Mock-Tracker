import { db, auth } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import {
  PlatformLearningSettings,
  VocabExtractionSettings,
  DEFAULT_PLATFORM_LEARNING_SETTINGS,
  DEFAULT_VOCAB_EXTRACTION_SETTINGS,
} from '../types/learningSettings';

const SETTINGS_COLLECTION = 'platform_settings';
const LEARNING_DOC_ID = 'learning';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Fetches the global platform learning and vocabulary extraction settings from Firestore.
 * If the document does not exist, returns safe defaults.
 */
export async function getLearningSettings(): Promise<PlatformLearningSettings> {
  const path = `${SETTINGS_COLLECTION}/${LEARNING_DOC_ID}`;
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, LEARNING_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as Partial<PlatformLearningSettings>;
      return {
        vocabExtraction: {
          ...DEFAULT_VOCAB_EXTRACTION_SETTINGS,
          ...(data.vocabExtraction || {}),
        },
        updatedAt: data.updatedAt || null,
        updatedBy: data.updatedBy || null,
      };
    }

    return DEFAULT_PLATFORM_LEARNING_SETTINGS;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return DEFAULT_PLATFORM_LEARNING_SETTINGS;
  }
}

/**
 * Saves/updates the platform learning settings in Firestore.
 * Requires admin/owner privileges according to security rules.
 */
export async function saveLearningSettings(
  settings: Partial<PlatformLearningSettings>
): Promise<void> {
  const path = `${SETTINGS_COLLECTION}/${LEARNING_DOC_ID}`;
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, LEARNING_DOC_ID);
    const current = await getLearningSettings();

    const payload: PlatformLearningSettings = {
      vocabExtraction: {
        ...current.vocabExtraction,
        ...(settings.vocabExtraction || {}),
      },
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.uid || auth.currentUser?.email || 'owner',
    };

    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Subscribes to real-time changes of the learning settings document.
 */
export function subscribeToLearningSettings(
  callback: (settings: PlatformLearningSettings) => void
): () => void {
  const path = `${SETTINGS_COLLECTION}/${LEARNING_DOC_ID}`;
  const docRef = doc(db, SETTINGS_COLLECTION, LEARNING_DOC_ID);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Partial<PlatformLearningSettings>;
        callback({
          vocabExtraction: {
            ...DEFAULT_VOCAB_EXTRACTION_SETTINGS,
            ...(data.vocabExtraction || {}),
          },
          updatedAt: data.updatedAt || null,
          updatedBy: data.updatedBy || null,
        });
      } else {
        callback(DEFAULT_PLATFORM_LEARNING_SETTINGS);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}
