import { useState, useEffect, useMemo } from 'react';
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
        setProfile({ ...data } as UserProfile);
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
        };
        // Don't setDoc inside onSnapshot here either. If we need to bootstrap, 
        // rely on an action or a separate hook.
        setProfile(newProfile);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
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
      if (data.bio.length > 0 && !/^[a-zA-Z0-9\s]*$/.test(data.bio)) throw new Error("Bio can only contain alphanumeric characters and spaces");
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      validateUserProfile(updates);
      await setDoc(doc(db, 'users', user.uid), {
        ...updates,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err: any) {
      console.error(err);
      throw err; // Rethrow to UI
    }
  };

  return useMemo(() => ({ profile, loading, updateProfile }), [profile, loading]);
}
