import { useState, useEffect, useMemo, useCallback } from 'react';
import { useChallengesQuery } from './useChallengesQuery';
import { useSystemDocsQuery } from './useSystemDocsQuery';
import { useCategoriesQuery } from './useCategoriesQuery';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useSystemData(user: any, profile: any, adminPermissions: any) {
  const [selectedCategory, setSelectedCategory] = useState<string>('banking');

  const { challenges, deletedChallenges, mutate: mutateChallenges } = useChallengesQuery(user, adminPermissions);
  const { notices, countdowns, liveMocks, pinnedCountdowns, pinnedNotices, pinnedChallenges, mutateSystemDocs } = useSystemDocsQuery();
  const { categories, mutateCategories } = useCategoriesQuery();

  useEffect(() => {
    if (profile?.categoryId) {
      setSelectedCategory(profile.categoryId);
    }
  }, [profile?.categoryId]);

  const fetchAnnouncement = useCallback(async () => {
    await Promise.all([
      mutateChallenges(),
      mutateSystemDocs(),
      mutateCategories()
    ]);
  }, [mutateChallenges, mutateSystemDocs, mutateCategories]);

  // Keep state matching the original hooks
  const togglePin = async (id: string, e: React.MouseEvent, canManageCountdowns: boolean) => {
    e.stopPropagation();
    if (!canManageCountdowns) return;
    
    let newPins = [...pinnedCountdowns];
    if (newPins.includes(id)) {
      newPins = newPins.filter(pid => pid !== id);
    } else {
      newPins.push(id);
      if (newPins.length > 3) newPins = newPins.slice(newPins.length - 3);
    }
    
    try {
      await setDoc(doc(db, 'system', 'config'), { 
        pinnedCountdowns: newPins,
        updatedAt: new Date().toISOString() 
      }, { merge: true });
      mutateSystemDocs((data: any) => ({ ...data, pinnedCountdowns: newPins }));
    } catch (err) {
      console.error("Error pinning countdown:", err);
    }
  };

  const togglePinNotice = async (id: string, e: React.MouseEvent, canManageNotices: boolean) => {
    e.stopPropagation();
    if (!canManageNotices) return;
    
    let newPins = [...pinnedNotices];
    if (newPins.includes(id)) {
      newPins = newPins.filter(pid => pid !== id);
    } else {
      newPins.push(id);
    }
    
    try {
      await setDoc(doc(db, 'system', 'config'), { 
        pinnedNotices: newPins,
        updatedAt: new Date().toISOString() 
      }, { merge: true });
      mutateSystemDocs((data: any) => ({ ...data, pinnedNotices: newPins }));
    } catch (err) {
      console.error("Error pinning notice:", err);
    }
  };

  // dummy setters for backward compatibility, since it's driven by SWR now
  const setNotices = () => {};
  const setChallenges = () => {};
  const setDeletedChallenges = () => {};
  const setCountdowns = () => {};
  const setPinnedCountdowns = () => {};
  const setPinnedNotices = () => {};
  const setPinnedChallenges = () => {};
  const setLiveMocks = () => {};

  return useMemo(() => ({
    categories,
    selectedCategory,
    setSelectedCategory,
    notices,
    setNotices,
    challenges,
    setChallenges,
    deletedChallenges,
    setDeletedChallenges,
    countdowns,
    setCountdowns,
    pinnedCountdowns,
    setPinnedCountdowns,
    pinnedNotices,
    setPinnedNotices,
    pinnedChallenges,
    setPinnedChallenges,
    liveMocks,
    setLiveMocks,
    fetchAnnouncement,
    togglePin,
    togglePinNotice,
  }), [
    categories, selectedCategory, notices, challenges, deletedChallenges, countdowns, pinnedCountdowns, pinnedNotices, pinnedChallenges, liveMocks, fetchAnnouncement
  ]);
}
