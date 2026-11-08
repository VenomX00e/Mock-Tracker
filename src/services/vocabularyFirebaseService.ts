import { db, auth } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  where
} from "firebase/firestore";
import type { EditorialCanvas } from "../store/vocabularyStore";
import type { CustomVocabFolder, Vocabulary } from "../types";

const CANVASES_COLLECTION = "editorial_canvases";
const USERS_COLLECTION = "users";
const CUSTOM_FOLDERS_SUBCOLLECTION = "customVocabFolders";

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

export function subscribeToCanvases(callback: (canvases: EditorialCanvas[]) => void) {
  const q = query(collection(db, CANVASES_COLLECTION), orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const canvases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EditorialCanvas));
    callback(canvases);
  }, (error) => {
    console.error("Error subscribing to canvases:", error);
  });
}

export async function saveCanvasToFirestore(canvas: EditorialCanvas) {
  const path = `${CANVASES_COLLECTION}/${canvas.id}`;
  try {
    const canvasRef = doc(db, CANVASES_COLLECTION, canvas.id);
    await setDoc(canvasRef, canvas);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCanvasFromFirestore(id: string) {
  const path = `${CANVASES_COLLECTION}/${id}`;
  try {
    const canvasRef = doc(db, CANVASES_COLLECTION, id);
    await deleteDoc(canvasRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==========================================
// 1. User Document Updates (users/{userId})
// ==========================================

/**
 * Add a vocabId to user's favoriteVocabIds using arrayUnion.
 * This does not duplicate heavy vocabulary data and is atomic.
 */
export async function addFavoriteVocab(userId: string, vocabId: string): Promise<void> {
  if (!userId || !vocabId) return;
  const path = `${USERS_COLLECTION}/${userId}`;
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      favoriteVocabIds: arrayUnion(vocabId),
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    // If user document didn't exist, bootstrap with merge
    if (error?.code === 'not-found') {
      try {
        await setDoc(doc(db, USERS_COLLECTION, userId), {
          userId,
          favoriteVocabIds: [vocabId],
          updatedAt: serverTimestamp(),
        }, { merge: true });
        return;
      } catch (nestedError) {
        handleFirestoreError(nestedError, OperationType.WRITE, path);
      }
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Remove a vocabId from user's favoriteVocabIds using arrayRemove.
 */
export async function removeFavoriteVocab(userId: string, vocabId: string): Promise<void> {
  if (!userId || !vocabId) return;
  const path = `${USERS_COLLECTION}/${userId}`;
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      favoriteVocabIds: arrayRemove(vocabId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Fetch favorite vocab IDs for a user once.
 */
export async function fetchFavoriteVocabIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const path = `${USERS_COLLECTION}/${userId}`;
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return Array.isArray(data.favoriteVocabIds) ? data.favoriteVocabIds : [];
    }
    return [];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

/**
 * Subscribe to real-time changes of user's favoriteVocabIds.
 */
export function subscribeToFavoriteVocabIds(
  userId: string,
  callback: (ids: string[]) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }
  const path = `${USERS_COLLECTION}/${userId}`;
  const userRef = doc(db, USERS_COLLECTION, userId);
  return onSnapshot(
    userRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        callback(Array.isArray(data.favoriteVocabIds) ? data.favoriteVocabIds : []);
      } else {
        callback([]);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// =========================================================================
// 2. Custom Folders Subcollection (users/{userId}/customVocabFolders/{folderId})
// =========================================================================

/**
 * Create a new personal custom folder under users/{userId}/customVocabFolders/{folderId}.
 */
export async function createCustomVocabFolder(
  userId: string,
  name: string,
  initialVocabIds: string[] = []
): Promise<CustomVocabFolder> {
  if (!userId) throw new Error("User ID is required to create a custom folder.");
  const folderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `${USERS_COLLECTION}/${userId}/${CUSTOM_FOLDERS_SUBCOLLECTION}/${folderId}`;
  
  const newFolder: CustomVocabFolder = {
    id: folderId,
    name: name.trim(),
    vocabIds: initialVocabIds,
  };

  try {
    const folderRef = doc(db, USERS_COLLECTION, userId, CUSTOM_FOLDERS_SUBCOLLECTION, folderId);
    await setDoc(folderRef, {
      ...newFolder,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newFolder;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

/**
 * Update a custom folder's name or entire vocabIds list.
 */
export async function updateCustomVocabFolder(
  userId: string,
  folderId: string,
  updates: { name?: string; vocabIds?: string[] }
): Promise<void> {
  if (!userId || !folderId) return;
  const path = `${USERS_COLLECTION}/${userId}/${CUSTOM_FOLDERS_SUBCOLLECTION}/${folderId}`;
  try {
    const folderRef = doc(db, USERS_COLLECTION, userId, CUSTOM_FOLDERS_SUBCOLLECTION, folderId);
    await updateDoc(folderRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Add a vocabId to a specific custom folder using arrayUnion.
 */
export async function addVocabToCustomFolder(
  userId: string,
  folderId: string,
  vocabId: string
): Promise<void> {
  if (!userId || !folderId || !vocabId) return;
  const path = `${USERS_COLLECTION}/${userId}/${CUSTOM_FOLDERS_SUBCOLLECTION}/${folderId}`;
  try {
    const folderRef = doc(db, USERS_COLLECTION, userId, CUSTOM_FOLDERS_SUBCOLLECTION, folderId);
    await updateDoc(folderRef, {
      vocabIds: arrayUnion(vocabId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Remove a vocabId from a specific custom folder using arrayRemove.
 */
export async function removeVocabFromCustomFolder(
  userId: string,
  folderId: string,
  vocabId: string
): Promise<void> {
  if (!userId || !folderId || !vocabId) return;
  const path = `${USERS_COLLECTION}/${userId}/${CUSTOM_FOLDERS_SUBCOLLECTION}/${folderId}`;
  try {
    const folderRef = doc(db, USERS_COLLECTION, userId, CUSTOM_FOLDERS_SUBCOLLECTION, folderId);
    await updateDoc(folderRef, {
      vocabIds: arrayRemove(vocabId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export const WRONG_VOCAB_FOLDER_ID = 'folder_wrong_words';

/**
 * Add multiple vocabIds to the reserved Wrong folder (creates it if it doesn't exist).
 */
export async function addVocabsToWrongFolder(
  userId: string,
  vocabIds: string[]
): Promise<void> {
  if (!userId || !vocabIds || vocabIds.length === 0) return;
  const path = `${USERS_COLLECTION}/${userId}/${CUSTOM_FOLDERS_SUBCOLLECTION}/${WRONG_VOCAB_FOLDER_ID}`;
  const folderRef = doc(
    db,
    USERS_COLLECTION,
    userId,
    CUSTOM_FOLDERS_SUBCOLLECTION,
    WRONG_VOCAB_FOLDER_ID
  );

  try {
    await updateDoc(folderRef, {
      vocabIds: arrayUnion(...vocabIds),
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    if (error?.code === 'not-found' || String(error?.message || '').includes('No document to update')) {
      try {
        await setDoc(folderRef, {
          id: WRONG_VOCAB_FOLDER_ID,
          name: 'Wrong',
          vocabIds: Array.from(new Set(vocabIds)),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      } catch (nestedError) {
        handleFirestoreError(nestedError, OperationType.CREATE, path);
      }
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Remove a vocabId from the reserved Wrong folder.
 */
export async function removeVocabFromWrongFolder(
  userId: string,
  vocabId: string
): Promise<void> {
  if (!userId || !vocabId) return;
  await removeVocabFromCustomFolder(userId, WRONG_VOCAB_FOLDER_ID, vocabId);
}

/**
 * Delete a custom folder.
 */
export async function deleteCustomVocabFolder(userId: string, folderId: string): Promise<void> {
  if (!userId || !folderId) return;
  const path = `${USERS_COLLECTION}/${userId}/${CUSTOM_FOLDERS_SUBCOLLECTION}/${folderId}`;
  try {
    const folderRef = doc(db, USERS_COLLECTION, userId, CUSTOM_FOLDERS_SUBCOLLECTION, folderId);
    await deleteDoc(folderRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Fetch all custom folders for a user once.
 */
export async function fetchCustomVocabFolders(userId: string): Promise<CustomVocabFolder[]> {
  if (!userId) return [];
  const path = `${USERS_COLLECTION}/${userId}/${CUSTOM_FOLDERS_SUBCOLLECTION}`;
  try {
    const colRef = collection(db, USERS_COLLECTION, userId, CUSTOM_FOLDERS_SUBCOLLECTION);
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustomVocabFolder));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Subscribe to real-time changes in a user's custom folders.
 */
export function subscribeToCustomVocabFolders(
  userId: string,
  callback: (folders: CustomVocabFolder[]) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }
  const path = `${USERS_COLLECTION}/${userId}/${CUSTOM_FOLDERS_SUBCOLLECTION}`;
  const colRef = collection(db, USERS_COLLECTION, userId, CUSTOM_FOLDERS_SUBCOLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const folders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CustomVocabFolder));
      callback(folders);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Extract all vocabulary items from an array of EditorialCanvases matching target IDs.
 */
export function extractVocabsFromCanvases(
  canvases: EditorialCanvas[],
  vocabIds: string[]
): Vocabulary[] {
  if (!vocabIds || vocabIds.length === 0 || !canvases || canvases.length === 0) return [];
  const idSet = new Set(vocabIds);
  const results: Vocabulary[] = [];

  for (const canvas of canvases) {
    if (canvas.vocabularies) {
      for (const v of canvas.vocabularies) {
        if (idSet.has(v.id)) {
          results.push({
            id: v.id,
            type: 'vocab',
            word: v.word,
            meaning: v.meaning,
            pos: v.pos,
            example: v.example,
            synonyms: v.synonyms,
            antonyms: v.antonyms,
            mnemonic: v.mnemonic,
            additional: v.additional,
            canvasId: canvas.id,
            canvasTitle: canvas.title,
            canvasDate: canvas.date,
            isMastered: v.isMastered,
          });
        }
      }
    }
    if (canvas.phrasalVerbs) {
      for (const p of canvas.phrasalVerbs) {
        if (idSet.has(p.id)) {
          results.push({
            id: p.id,
            type: 'phrasal_verb',
            word: p.text,
            meaning: p.meaning,
            example: p.example,
            canvasId: canvas.id,
            canvasTitle: canvas.title,
            canvasDate: canvas.date,
          });
        }
      }
    }
    if (canvas.idioms) {
      for (const i of canvas.idioms) {
        if (idSet.has(i.id)) {
          results.push({
            id: i.id,
            type: 'idiom',
            word: i.text,
            meaning: i.meaning,
            example: i.example,
            canvasId: canvas.id,
            canvasTitle: canvas.title,
            canvasDate: canvas.date,
          });
        }
      }
    }
    if (canvas.oneWordSubs) {
      for (const o of canvas.oneWordSubs) {
        if (idSet.has(o.id)) {
          results.push({
            id: o.id,
            type: 'one_word_sub',
            word: o.text,
            meaning: o.meaning,
            example: o.example,
            canvasId: canvas.id,
            canvasTitle: canvas.title,
            canvasDate: canvas.date,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Fetches actual word data for given vocab IDs from Firestore in chunks of 30
 * using where('id', 'in', chunk). Also queries/enriches with editorial_canvases
 * to guarantee all four content types (vocabs, phrasal verbs, idioms, one word subs)
 * are populated with zero omissions.
 */
export async function fetchVocabulariesInChunks(
  vocabIds: string[],
  cachedCanvases?: EditorialCanvas[]
): Promise<Vocabulary[]> {
  if (!vocabIds || vocabIds.length === 0) return [];

  const resultsMap = new Map<string, Vocabulary>();
  const CHUNK_SIZE = 30;

  // Split IDs into chunks of up to 30 items
  const chunks: string[][] = [];
  for (let i = 0; i < vocabIds.length; i += CHUNK_SIZE) {
    chunks.push(vocabIds.slice(i, i + CHUNK_SIZE));
  }

  // 1. Query Firestore in chunks of 30 using where('id', 'in', chunk)
  for (const chunk of chunks) {
    try {
      const vocabQuery = query(
        collection(db, "vocabularies"),
        where("id", "in", chunk)
      );
      const snap = await getDocs(vocabQuery);
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        resultsMap.set(data.id, {
          id: data.id,
          type: data.type || 'vocab',
          word: data.word || data.text,
          meaning: data.meaning || '',
          pos: data.pos,
          example: data.example,
          synonyms: data.synonyms,
          antonyms: data.antonyms,
          mnemonic: data.mnemonic,
          additional: data.additional,
          canvasId: data.canvasId,
          canvasTitle: data.canvasTitle,
          canvasDate: data.canvasDate,
          isMastered: data.isMastered,
        });
      });
    } catch {
      // In case standalone collection is not used, fallback smoothly
    }
  }

  // 2. Enrich/resolve from editorial_canvases
  let canvases = cachedCanvases;
  if (!canvases || canvases.length === 0) {
    try {
      const canvasesSnap = await getDocs(
        query(collection(db, CANVASES_COLLECTION), orderBy("date", "desc"))
      );
      canvases = canvasesSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as EditorialCanvas)
      );
    } catch (e) {
      console.warn("Could not fetch canvases from Firestore for vocabulary extraction", e);
      canvases = [];
    }
  }

  const canvasVocabs = extractVocabsFromCanvases(canvases, vocabIds);
  for (const item of canvasVocabs) {
    if (!resultsMap.has(item.id)) {
      resultsMap.set(item.id, item);
    }
  }

  // 3. Return results preserving the order of requested IDs
  const orderedResults: Vocabulary[] = [];
  for (const id of vocabIds) {
    const item = resultsMap.get(id);
    if (item) {
      orderedResults.push(item);
    }
  }

  return orderedResults;
}

