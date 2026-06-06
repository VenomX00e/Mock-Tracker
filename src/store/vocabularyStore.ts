import { create } from 'zustand';
import { saveCanvasToFirestore, deleteCanvasFromFirestore } from '../services/vocabularyFirebaseService';

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

interface VocabularyState {
  canvases: EditorialCanvas[];
  isLoaded: boolean;
  setCanvases: (canvases: EditorialCanvas[]) => void;
  addCanvas: (canvas: Omit<EditorialCanvas, 'id' | 'vocabularies' | 'phrasalVerbs' | 'idioms' | 'oneWordSubs'>) => void;
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
  
  setCanvases: (canvases) => set({ canvases, isLoaded: true }),

  addCanvas: (canvas) => {
    const newCanvas = {
      id: Math.random().toString(36).substring(2, 9),
      ...canvas,
      vocabularies: [],
      phrasalVerbs: [],
      idioms: [],
      oneWordSubs: []
    };
    set((state) => ({ canvases: [...state.canvases, newCanvas] }));
    saveCanvasToFirestore(newCanvas);
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
