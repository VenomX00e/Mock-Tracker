import { useState, useEffect } from 'react';
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
        let needsUpdate = false;
        const updates: any = {};
        
        if (!data.email && user.email) {
           updates.email = user.email;
           needsUpdate = true;
        }
        
        const now = Date.now();
        const lastActive = data.lastActiveAt || 0;
        // Update activity if it's been more than 5 minutes since last update
        if (now - lastActive > 5 * 60 * 1000) {
           updates.lastActiveAt = now;
           needsUpdate = true;
        }

        if (needsUpdate) {
           setDoc(docRef, updates, { merge: true });
        }
        
        setProfile({ ...data } as UserProfile);
      } else {
        // Initialize profile
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
        setDoc(docRef, { ...newProfile, updatedAt: serverTimestamp() }, { merge: true });
        setProfile(newProfile);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...updates,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error(err);
    }
  };

  return { profile, loading, updateProfile };
}
