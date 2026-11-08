import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { SeriesPattern, SeriesCategory } from '../types/seriesTypes';

const STORAGE_KEY = 'ypt_saved_series_patterns';
const SYNC_EVENT = 'series-patterns-updated';

function getStoredPatterns(): SeriesPattern[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[useSeriesVault] Failed to read from localStorage:', err);
    return [];
  }
}

function setStoredPatterns(patterns: SeriesPattern[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
    return true;
  } catch (err) {
    console.error('[useSeriesVault] Failed to write to localStorage:', err);
    return false;
  }
}

export function useSeriesVault() {
  const [patterns, setPatterns] = useState<SeriesPattern[]>(() => getStoredPatterns());
  const [loading, setLoading] = useState<boolean>(true);
  const isInitialSyncRef = useRef<boolean>(true);

  // 1. LocalStorage & Multi-Tab Synchronization
  useEffect(() => {
    setPatterns(getStoredPatterns());

    const handleSync = () => {
      setPatterns(getStoredPatterns());
    };

    window.addEventListener(SYNC_EVENT, handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener(SYNC_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // 2. Real-Time Background Synchronization with Firestore (users/{uid}/seriesVault)
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const vaultRef = collection(db, 'users', user.uid, 'seriesVault');
      const vaultQuery = query(vaultRef, orderBy('savedAt', 'desc'));

      unsubscribeFirestore = onSnapshot(
        vaultQuery,
        (snapshot) => {
          const remotePatterns: SeriesPattern[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remotePatterns.push({
              id: docSnap.id,
              title: data.title || '',
              category: (data.category as SeriesCategory) || 'difference',
              steps: data.steps || [],
              generatorKey: data.generatorKey || 'custom_pattern',
              generatorParams: data.generatorParams || {},
              savedAt: data.savedAt?.toMillis ? data.savedAt.toMillis() : (data.savedAt || Date.now()),
              userId: user.uid,
            });
          });

          // Merge local and remote
          const localPatterns = getStoredPatterns();
          
          if (isInitialSyncRef.current && localPatterns.length > 0 && remotePatterns.length === 0) {
            // Seed local un-synced patterns to Firestore on first load
            localPatterns.forEach(async (p) => {
              try {
                const targetDoc = doc(db, 'users', user.uid, 'seriesVault', p.id);
                await setDoc(targetDoc, {
                  ...p,
                  userId: user.uid,
                  savedAt: serverTimestamp(),
                }, { merge: true });
              } catch (e) {
                console.error('[useSeriesVault] Seeding error:', e);
              }
            });
          }

          // Combine with deduplication prioritizing newest
          const map = new Map<string, SeriesPattern>();
          remotePatterns.forEach(p => map.set(p.id, p));
          localPatterns.forEach(p => {
            if (!map.has(p.id)) {
              map.set(p.id, p);
            }
          });

          const merged = Array.from(map.values()).sort((a, b) => b.savedAt - a.savedAt);
          setStoredPatterns(merged);
          setPatterns(merged);
          setLoading(false);
          isInitialSyncRef.current = false;
        },
        (error) => {
          console.warn('[useSeriesVault] Firestore snapshot error, falling back to local cache:', error);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, []);

  const isSaved = useCallback((idOrTitle: string): boolean => {
    if (!idOrTitle) return false;
    const target = idOrTitle.trim().toLowerCase();
    return patterns.some(p => 
      p.id?.toLowerCase() === target || 
      p.title?.trim().toLowerCase() === target
    );
  }, [patterns]);

  const savePattern = useCallback(async (pattern: Omit<SeriesPattern, 'savedAt'>): Promise<void> => {
    const patternId = pattern.id || pattern.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const newPattern: SeriesPattern = {
      ...pattern,
      id: patternId,
      savedAt: Date.now()
    };

    // 1. Optimistic Local Update
    const current = getStoredPatterns().filter(p => p.id !== patternId);
    const updated = [newPattern, ...current];
    setStoredPatterns(updated);
    setPatterns(updated);

    // 2. Firestore Cloud Sync
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const patternDoc = doc(db, 'users', currentUser.uid, 'seriesVault', patternId);
        await setDoc(patternDoc, {
          ...newPattern,
          userId: currentUser.uid,
          savedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error('[useSeriesVault] Firestore save error:', err);
      }
    }
  }, []);

  const removePattern = useCallback(async (idOrTitle: string): Promise<void> => {
    if (!idOrTitle) return;
    const target = idOrTitle.trim().toLowerCase();
    
    // Find matching pattern
    const patternToRemove = patterns.find(p => 
      p.id?.toLowerCase() === target || 
      p.title?.trim().toLowerCase() === target
    );
    const targetId = patternToRemove?.id || idOrTitle;

    // 1. Optimistic Local Update
    const current = getStoredPatterns();
    const updated = current.filter(p => 
      p.id?.toLowerCase() !== target && 
      p.title?.trim().toLowerCase() !== target
    );
    setStoredPatterns(updated);
    setPatterns(updated);

    // 2. Firestore Cloud Delete
    const currentUser = auth.currentUser;
    if (currentUser && targetId) {
      try {
        const patternDoc = doc(db, 'users', currentUser.uid, 'seriesVault', targetId);
        await deleteDoc(patternDoc);
      } catch (err) {
        console.error('[useSeriesVault] Firestore remove error:', err);
      }
    }
  }, [patterns]);

  const toggleSavePattern = useCallback(async (pattern: Omit<SeriesPattern, 'savedAt'>): Promise<{ saved: boolean }> => {
    const patternId = pattern.id || pattern.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (isSaved(patternId)) {
      await removePattern(patternId);
      return { saved: false };
    } else {
      await savePattern(pattern);
      return { saved: true };
    }
  }, [isSaved, removePattern, savePattern]);

  const getPatternsByCategory = useCallback((category: SeriesCategory | 'all'): SeriesPattern[] => {
    if (category === 'all') return patterns;
    return patterns.filter(p => p.category === category);
  }, [patterns]);

  return {
    patterns,
    loading,
    isSaved,
    isPatternSaved: isSaved,
    savePattern,
    removePattern,
    toggleSavePattern,
    getPatternsByCategory
  };
}
