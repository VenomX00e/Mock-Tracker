import { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../services/AuthContext';
import { UserProfile } from '../types';

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile({
          ...data,
          yptNames: Array.isArray(data.yptNames) ? data.yptNames : [],
          defaultYptHandle: typeof data.defaultYptHandle === 'string' ? data.defaultYptHandle : undefined,
          favoriteVocabIds: Array.isArray(data.favoriteVocabIds) ? data.favoriteVocabIds : [],
        } as UserProfile);
      } else {
        // Initialize profile locally to avoid immediate write loop inside read listener
        const newProfile: UserProfile = {
          userId: user.uid,
          email: user.email || undefined,
          displayName: user.displayName || 'Anonymous',
          photoURL: user.photoURL || 'https://ui-avatars.com/api/?name=User&background=random',
          targetedExam: 'SBI PO',
          avgPercentile: 0,
          avgQuantPercentile: 0,
          avgReasoningPercentile: 0,
          avgEnglishPercentile: 0,
          totalTests: 0,
          streak: 0,
          yptNames: [],
          favoriteVocabIds: [],
        };
        // Don't setDoc inside onSnapshot here either. If we need to bootstrap, 
        // rely on an action or a separate hook.
        setProfile(newProfile);
      }
      setLoading(false);
    }, (err: any) => {
      if (err.code === 'permission-denied') {
        // Ignore permission-denied errors during sign-out
      } else {
        console.error(err);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const validateUserProfile = (data: Partial<UserProfile>) => {
    if (data.displayName && data.displayName.length > 200) throw new Error("Display name too long");
    if (data.targetedExam && data.targetedExam.length > 100) throw new Error("Targeted exam too long");
    if (data.photoURL && data.photoURL.length > 500) throw new Error("Photo URL too long");
    if (data.bio !== undefined) {
      if (data.bio.length > 70) throw new Error("Bio must be 70 characters or less");
      if (data.bio.length > 0 && !/^[a-zA-Z0-9\s.,!?-]*$/.test(data.bio)) throw new Error("Bio can contain letters, numbers, spaces, and punctuation.");
    }
    if (data.yptNames !== undefined) {
      if (!Array.isArray(data.yptNames)) throw new Error("YPT Names must be an array");
      if (data.yptNames.some(name => typeof name !== 'string')) {
        throw new Error("YPT Names must be strings");
      }
      if (data.yptNames.some(name => name.length > 50)) {
        throw new Error("Each YPT Name must be 50 characters or less");
      }
    }
    if (data.defaultYptHandle !== undefined && data.defaultYptHandle !== null) {
      if (typeof data.defaultYptHandle !== 'string') {
        throw new Error("Default YPT handle must be a string");
      }
      if (data.defaultYptHandle.length > 50) {
        throw new Error("Default YPT handle must be 50 characters or less");
      }
    }
  };

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      validateUserProfile(updates);
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, val]) => val !== undefined)
      );
      await setDoc(doc(db, 'users', user.uid), {
        userId: user.uid,
        ...cleanUpdates,
        lastActiveAt: Date.now(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err: any) {
      console.error(err);
      throw err; // Rethrow to UI
    }
  }, [user]);

  const togglePracticeFileCompletion = useCallback(async (fileId: string) => {
    if (!user || !profile) return;
    const currentCompleted = profile.completedPracticeFiles || [];
    const isCompleted = currentCompleted.includes(fileId);
    const newCompleted = isCompleted 
      ? currentCompleted.filter(id => id !== fileId)
      : [...currentCompleted, fileId];
    try {
      await updateProfile({ completedPracticeFiles: newCompleted });
    } catch (e) {
      console.error("Failed to toggle completion", e);
    }
  }, [user, profile, updateProfile]);

  return useMemo(() => ({ profile, loading, updateProfile, togglePracticeFileCompletion }), [profile, loading, updateProfile, togglePracticeFileCompletion]);
}
