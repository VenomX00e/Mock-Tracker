import { create } from 'zustand';
import { auth } from '../services/firebase';
import {
  saveCanvasToFirestore,
  deleteCanvasFromFirestore,
  addFavoriteVocab,
  removeFavoriteVocab,
  createCustomVocabFolder,
  addVocabToCustomFolder,
  removeVocabFromCustomFolder,
  deleteCustomVocabFolder,
  subscribeToFavoriteVocabIds,
  subscribeToCustomVocabFolders,
  WRONG_VOCAB_FOLDER_ID,
  addVocabsToWrongFolder,
  removeVocabFromWrongFolder,
} from '../services/vocabularyFirebaseService';
import type { CustomVocabFolder, CustomFolder, Vocabulary } from '../types';

export type { CustomVocabFolder, CustomFolder, Vocabulary };

export interface VocabEntry {
  id: string;
  word: string;
  pos: string; // Part of Speech
  synonyms: string[];
  antonyms: string[];
  example: string;
  meaning: string;
  mnemonic: string;
  additional?: string;
  isMastered: boolean;
}

export interface TextEntry {
  id: string;
  text: string;
  meaning: string;
  example?: string;
}

export interface EditorialCanvas {
  id: string;
  title: string;
  date: string;
  vocabularies: VocabEntry[];
  phrasalVerbs: TextEntry[];
  idioms: TextEntry[];
  oneWordSubs: TextEntry[];
}

export function computeFavoritedVocabsData(
  canvases: EditorialCanvas[],
  favoriteVocabIds: string[]
): Vocabulary[] {
  if (!favoriteVocabIds || favoriteVocabIds.length === 0) return [];
  const vocabIdSet = new Set(favoriteVocabIds);
  const results: Vocabulary[] = [];

  for (const canvas of canvases) {
    if (canvas.vocabularies) {
      for (const v of canvas.vocabularies) {
        if (vocabIdSet.has(v.id)) {
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
        if (vocabIdSet.has(p.id)) {
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
        if (vocabIdSet.has(i.id)) {
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
        if (vocabIdSet.has(o.id)) {
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

interface VocabularyState {
  canvases: EditorialCanvas[];
  isLoaded: boolean;
  favoriteVocabIds: string[];
  wrongVocabIds: string[];
  customFolders: CustomFolder[];
  favoritedVocabsData: Vocabulary[];

  setCanvases: (canvases: EditorialCanvas[]) => void;
  setFavoriteVocabIds: (ids: string[]) => void;
  setCustomFolders: (folders: CustomFolder[]) => void;
  toggleFavorite: (vocabId: string) => Promise<void>;
  addWrongVocabs: (vocabIds: string[]) => Promise<void>;
  removeWrongVocab: (vocabId: string) => Promise<void>;
  createCustomFolder: (name: string, initialVocabIds?: string[]) => Promise<CustomVocabFolder>;
  addVocabToFolder: (folderId: string, vocabId: string) => Promise<void>;
  removeVocabFromFolder: (folderId: string, vocabId: string) => Promise<void>;
  deleteCustomFolder: (folderId: string) => Promise<void>;
  syncUserDataOnLogin: (userId: string | null) => () => void;

  addCanvas: (canvas: {
    id?: string;
    title: string;
    date: string;
    vocabularies?: VocabEntry[];
    phrasalVerbs?: TextEntry[];
    idioms?: TextEntry[];
    oneWordSubs?: TextEntry[];
  }) => string;
  deleteCanvas: (id: string) => void;
  updateCanvas: (id: string, updates: Partial<EditorialCanvas>) => void;
  addVocab: (canvasId: string, vocab: Omit<VocabEntry, 'id' | 'isMastered'>) => void;
  updateVocab: (canvasId: string, vocabId: string, updates: Partial<VocabEntry>) => void;
  deleteVocab: (canvasId: string, vocabId: string) => void;
  addTextEntry: (canvasId: string, type: 'phrasalVerbs' | 'idioms' | 'oneWordSubs', entry: Omit<TextEntry, 'id'>) => void;
  updateTextEntry: (canvasId: string, type: 'phrasalVerbs' | 'idioms' | 'oneWordSubs', entryId: string, updates: Partial<TextEntry>) => void;
  deleteTextEntry: (canvasId: string, type: 'phrasalVerbs' | 'idioms' | 'oneWordSubs', entryId: string) => void;
}

export const useVocabularyStore = create<VocabularyState>((set, get) => ({
  canvases: [],
  isLoaded: false,
  favoriteVocabIds: [],
  wrongVocabIds: [],
  customFolders: [],
  favoritedVocabsData: [],
  
  setCanvases: (canvases) => {
    const currentFavIds = get().favoriteVocabIds;
    set({
      canvases,
      isLoaded: true,
      favoritedVocabsData: computeFavoritedVocabsData(canvases, currentFavIds),
    });
  },

  setFavoriteVocabIds: (favoriteVocabIds) => {
    set({
      favoriteVocabIds,
      favoritedVocabsData: computeFavoritedVocabsData(get().canvases, favoriteVocabIds),
    });
  },

  setCustomFolders: (allFolders) => {
    const wrongFolder = allFolders.find((f) => f.id === WRONG_VOCAB_FOLDER_ID);
    const userFolders = allFolders.filter((f) => f.id !== WRONG_VOCAB_FOLDER_ID);
    set({
      customFolders: userFolders,
      wrongVocabIds: wrongFolder?.vocabIds || [],
    });
  },

  toggleFavorite: async (vocabId: string) => {
    const userId = auth.currentUser?.uid;
    const isCurrentlyFav = get().favoriteVocabIds.includes(vocabId);
    const newFavoriteIds = isCurrentlyFav
      ? get().favoriteVocabIds.filter((id) => id !== vocabId)
      : [...get().favoriteVocabIds, vocabId];

    // Optimistic UI state update
    set({
      favoriteVocabIds: newFavoriteIds,
      favoritedVocabsData: computeFavoritedVocabsData(get().canvases, newFavoriteIds),
    });

    // Background Firebase synchronization
    if (userId) {
      try {
        if (isCurrentlyFav) {
          await removeFavoriteVocab(userId, vocabId);
        } else {
          await addFavoriteVocab(userId, vocabId);
        }
      } catch (error) {
        console.error("Failed to update favorite status in Firebase, rolling back:", error);
        // Rollback state if network/permission failure
        const rolledBackIds = get().favoriteVocabIds.includes(vocabId)
          ? get().favoriteVocabIds.filter((id) => id !== vocabId)
          : [...get().favoriteVocabIds, vocabId];
        set({
          favoriteVocabIds: rolledBackIds,
          favoritedVocabsData: computeFavoritedVocabsData(get().canvases, rolledBackIds),
        });
      }
    }
  },

  addWrongVocabs: async (vocabIds: string[]) => {
    const cleanIds = Array.from(new Set(vocabIds.filter(Boolean)));
    if (cleanIds.length === 0) return;

    const userId = auth.currentUser?.uid;
    const prevWrongIds = get().wrongVocabIds;
    const prevFavIds = get().favoriteVocabIds;

    const nextWrongIds = Array.from(new Set([...prevWrongIds, ...cleanIds]));
    const missingFavIds = cleanIds.filter((id) => !prevFavIds.includes(id));
    const nextFavIds =
      missingFavIds.length > 0 ? [...prevFavIds, ...missingFavIds] : prevFavIds;

    // Optimistic UI update
    set({
      wrongVocabIds: nextWrongIds,
      favoriteVocabIds: nextFavIds,
      favoritedVocabsData: computeFavoritedVocabsData(get().canvases, nextFavIds),
    });

    if (userId) {
      try {
        await addVocabsToWrongFolder(userId, cleanIds);
        for (const favId of missingFavIds) {
          await addFavoriteVocab(userId, favId);
        }
      } catch (error) {
        console.error('Failed to add wrong vocabs in Firebase, rolling back:', error);
        set({
          wrongVocabIds: prevWrongIds,
          favoriteVocabIds: prevFavIds,
          favoritedVocabsData: computeFavoritedVocabsData(get().canvases, prevFavIds),
        });
        throw error;
      }
    }
  },

  removeWrongVocab: async (vocabId: string) => {
    if (!vocabId) return;
    const userId = auth.currentUser?.uid;
    const prevWrongIds = get().wrongVocabIds;
    if (!prevWrongIds.includes(vocabId)) return;

    const nextWrongIds = prevWrongIds.filter((id) => id !== vocabId);
    set({ wrongVocabIds: nextWrongIds });

    if (userId) {
      try {
        await removeVocabFromWrongFolder(userId, vocabId);
      } catch (error) {
        console.error('Failed to remove wrong vocab in Firebase, rolling back:', error);
        set({ wrongVocabIds: prevWrongIds });
      }
    }
  },

  createCustomFolder: async (name: string, initialVocabIds: string[] = []) => {
    const userId = auth.currentUser?.uid;
    const tempId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newFolder: CustomVocabFolder = {
      id: tempId,
      name: name.trim(),
      vocabIds: initialVocabIds,
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    set((state) => ({
      customFolders: [...state.customFolders, newFolder],
    }));

    if (userId) {
      try {
        const created = await createCustomVocabFolder(userId, name, initialVocabIds);
        set((state) => ({
          customFolders: state.customFolders.map((f) => (f.id === tempId ? created : f)),
        }));
        return created;
      } catch (error) {
        console.error("Failed to create custom folder in Firebase:", error);
        // Rollback
        set((state) => ({
          customFolders: state.customFolders.filter((f) => f.id !== tempId),
        }));
        throw error;
      }
    }
    return newFolder;
  },

  addVocabToFolder: async (folderId: string, vocabId: string) => {
    const userId = auth.currentUser?.uid;
    const folder = get().customFolders.find((f) => f.id === folderId);
    if (!folder) return;
    if (folder.vocabIds.includes(vocabId)) return;

    const updatedVocabIds = [...folder.vocabIds, vocabId];

    // Optimistic update
    set((state) => ({
      customFolders: state.customFolders.map((f) =>
        f.id === folderId ? { ...f, vocabIds: updatedVocabIds } : f
      ),
    }));

    if (userId) {
      try {
        await addVocabToCustomFolder(userId, folderId, vocabId);
      } catch (error) {
        console.error("Failed to add vocab to folder in Firebase:", error);
        // Rollback
        set((state) => ({
          customFolders: state.customFolders.map((f) =>
            f.id === folderId ? { ...f, vocabIds: folder.vocabIds } : f
          ),
        }));
      }
    }
  },

  removeVocabFromFolder: async (folderId: string, vocabId: string) => {
    const userId = auth.currentUser?.uid;
    const folder = get().customFolders.find((f) => f.id === folderId);
    if (!folder) return;
    if (!folder.vocabIds.includes(vocabId)) return;

    const updatedVocabIds = folder.vocabIds.filter((id) => id !== vocabId);

    // Optimistic update
    set((state) => ({
      customFolders: state.customFolders.map((f) =>
        f.id === folderId ? { ...f, vocabIds: updatedVocabIds } : f
      ),
    }));

    if (userId) {
      try {
        await removeVocabFromCustomFolder(userId, folderId, vocabId);
      } catch (error) {
        console.error("Failed to remove vocab from folder in Firebase:", error);
        // Rollback
        set((state) => ({
          customFolders: state.customFolders.map((f) =>
            f.id === folderId ? { ...f, vocabIds: folder.vocabIds } : f
          ),
        }));
      }
    }
  },

  deleteCustomFolder: async (folderId: string) => {
    const userId = auth.currentUser?.uid;
    const existingFolders = get().customFolders;
    const folderToDelete = existingFolders.find((f) => f.id === folderId);
    if (!folderToDelete) return;

    // Optimistic update
    set((state) => ({
      customFolders: state.customFolders.filter((f) => f.id !== folderId),
    }));

    if (userId) {
      try {
        await deleteCustomVocabFolder(userId, folderId);
      } catch (error) {
        console.error("Failed to delete custom folder in Firebase:", error);
        // Rollback
        set({ customFolders: existingFolders });
      }
    }
  },

  syncUserDataOnLogin: (userId: string | null) => {
    if (!userId) {
      set({ favoriteVocabIds: [], wrongVocabIds: [], customFolders: [], favoritedVocabsData: [] });
      return () => {};
    }

    const unsubFavs = subscribeToFavoriteVocabIds(userId, (ids) => {
      get().setFavoriteVocabIds(ids);
    });

    const unsubFolders = subscribeToCustomVocabFolders(userId, (folders) => {
      get().setCustomFolders(folders);
    });

    return () => {
      unsubFavs();
      unsubFolders();
    };
  },

  addCanvas: (canvas) => {
    const id = canvas.id || Math.random().toString(36).substring(2, 9);
    const newCanvas: EditorialCanvas = {
      id,
      title: canvas.title,
      date: canvas.date,
      vocabularies: canvas.vocabularies || [],
      phrasalVerbs: canvas.phrasalVerbs || [],
      idioms: canvas.idioms || [],
      oneWordSubs: canvas.oneWordSubs || [],
    };
    set((state) => ({ canvases: [...state.canvases, newCanvas] }));
    saveCanvasToFirestore(newCanvas);
    return id;
  },
  
  deleteCanvas: (id) => {
    set((state) => ({ canvases: state.canvases.filter((c) => c.id !== id) }));
    deleteCanvasFromFirestore(id);
  },

  updateCanvas: (id, updates) => {
    const state = get();
    const canvas = state.canvases.find(c => c.id === id);
    if (!canvas) return;
    const updatedCanvas = { ...canvas, ...updates };
    set((state) => ({ canvases: state.canvases.map(c => c.id === id ? updatedCanvas : c) }));
    saveCanvasToFirestore(updatedCanvas);
  },
  
  addVocab: (canvasId, vocab) => {
    const state = get();
    const canvas = state.canvases.find(c => c.id === canvasId);
    if (!canvas) return;
    const updatedCanvas = { 
      ...canvas, 
      vocabularies: [...canvas.vocabularies, { ...vocab, id: Math.random().toString(36).substring(2, 9), isMastered: false }] 
    };
    set((state) => ({ canvases: state.canvases.map(c => c.id === canvasId ? updatedCanvas : c) }));
    saveCanvasToFirestore(updatedCanvas);
  },
  
  updateVocab: (canvasId, vocabId, updates) => {
    const state = get();
    const canvas = state.canvases.find(c => c.id === canvasId);
    if (!canvas) return;
    const updatedCanvas = { 
      ...canvas, 
      vocabularies: canvas.vocabularies.map((v) => v.id === vocabId ? { ...v, ...updates } : v) 
    };
    set((state) => ({ canvases: state.canvases.map(c => c.id === canvasId ? updatedCanvas : c) }));
    saveCanvasToFirestore(updatedCanvas);
  },
  
  addTextEntry: (canvasId, type, entry) => {
    const state = get();
    const canvas = state.canvases.find(c => c.id === canvasId);
    if (!canvas) return;
    const updatedCanvas = { 
      ...canvas, 
      [type]: [...(canvas[type] || []), { ...entry, id: Math.random().toString(36).substring(2, 9) }] 
    };
    set((state) => ({ canvases: state.canvases.map(c => c.id === canvasId ? updatedCanvas : c) }));
    saveCanvasToFirestore(updatedCanvas);
  },
  
  updateTextEntry: (canvasId, type, entryId, updates) => {
    const state = get();
    const canvas = state.canvases.find(c => c.id === canvasId);
    if (!canvas) return;
    const updatedCanvas = { 
      ...canvas, 
      [type]: (canvas[type] || []).map((e) => e.id === entryId ? { ...e, ...updates } : e) 
    };
    set((state) => ({ canvases: state.canvases.map(c => c.id === canvasId ? updatedCanvas : c) }));
    saveCanvasToFirestore(updatedCanvas);
  },

  deleteVocab: (canvasId, vocabId) => {
    const state = get();
    const canvas = state.canvases.find(c => c.id === canvasId);
    if (!canvas) return;
    const updatedCanvas = {
      ...canvas,
      vocabularies: (canvas.vocabularies || []).filter((v) => v.id !== vocabId)
    };
    set((state) => ({ canvases: state.canvases.map(c => c.id === canvasId ? updatedCanvas : c) }));
    saveCanvasToFirestore(updatedCanvas);
  },

  deleteTextEntry: (canvasId, type, entryId) => {
    const state = get();
    const canvas = state.canvases.find(c => c.id === canvasId);
    if (!canvas) return;
    const updatedCanvas = {
      ...canvas,
      [type]: (canvas[type] || []).filter((e) => e.id !== entryId)
    };
    set((state) => ({ canvases: state.canvases.map(c => c.id === canvasId ? updatedCanvas : c) }));
    saveCanvasToFirestore(updatedCanvas);
  }
}));

