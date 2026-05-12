import { useState, useMemo } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useChallengesManager(
    user: any, 
    adminPermissions: any, 
    pinnedChallenges: string[], 
    setPinnedChallenges: (pins: string[]) => void, 
    fetchAnnouncement: () => Promise<void>
) {
  const [dismissedChallenges, setDismissedChallenges] = useState<string[]>(JSON.parse(localStorage.getItem('dismissedChallenges') || '[]'));

  const dismissChallenge = (id: string) => {
    const updated = [...dismissedChallenges, id];
    setDismissedChallenges(updated);
    localStorage.setItem('dismissedChallenges', JSON.stringify(updated));
  };

  const unhideChallenge = (id: string) => {
    const updated = dismissedChallenges.filter((cid) => cid !== id);
    setDismissedChallenges(updated);
    if (updated.length === 0) {
      localStorage.removeItem('dismissedChallenges');
    } else {
      localStorage.setItem('dismissedChallenges', JSON.stringify(updated));
    }
  };

  const restoreChallenges = () => {
    setDismissedChallenges([]);
    localStorage.removeItem('dismissedChallenges');
  };

  const handleApproveChallenge = async (id: string) => {
    try {
      await setDoc(doc(db, 'challenges', id), { approvalStatus: 'approved' }, { merge: true });
      await fetchAnnouncement();
      alert("Challenge approved successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to approve challenge: " + error);
    }
  };

  const handleRejectChallenge = async (id: string) => {
    try {
      await setDoc(doc(db, 'challenges', id), { approvalStatus: 'rejected' }, { merge: true });
      await fetchAnnouncement();
      alert("Challenge rejected successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to reject challenge: " + error);
    }
  };

  const handleDeleteChallenge = async (challenge: any) => {
    try {
      if (adminPermissions?.canManageChallenges && challenge.creatorId !== user?.uid) {
          await setDoc(doc(db, 'challenges', challenge.id), { deletedByAdmin: true }, { merge: true });
      } else if (challenge.visibility === 'global' && challenge.approvalStatus === 'approved') {
          await setDoc(doc(db, 'challenges', challenge.id), { deletedByCreator: true }, { merge: true });
      } else {
          await setDoc(doc(db, 'challenges', challenge.id), { status: 'deleted' }, { merge: true });
      }
      await fetchAnnouncement();
      console.log('Challenge deleted successfully');
    } catch (e) {
      console.error("Error deleting challenge", e);
      alert("Failed to delete challenge.");
    }
  };

  const handlePinChallenge = async (challenge: any) => {
    if (!adminPermissions?.canManageChallenges) return;
    
    let newPins = [...pinnedChallenges];
    if (newPins.includes(challenge.id)) {
      newPins = newPins.filter(pid => pid !== challenge.id);
    } else {
      newPins.push(challenge.id);
      if (newPins.length > 3) {
        newPins = newPins.slice(newPins.length - 3);
      }
    }

    try {
      await setDoc(doc(db, 'system', 'config'), { 
        pinnedChallenges: newPins,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setPinnedChallenges(newPins);
      await fetchAnnouncement();
    } catch (e) {
      console.error("Error pinning challenge", e);
    }
  };

  const handleRestoreChallenge = async (challenge: any) => {
    try {
      if (adminPermissions?.canManageChallenges && challenge.creatorId !== user?.uid) {
          await setDoc(doc(db, 'challenges', challenge.id), { deletedByAdmin: false, permanentlyDeletedByAdmin: false }, { merge: true });
      } else {
          await setDoc(doc(db, 'challenges', challenge.id), { status: 'active', deletedByCreator: false, permanentlyDeletedByCreator: false }, { merge: true });
      }
      await fetchAnnouncement();
      console.log('Challenge restored successfully');
    } catch (e) {
      console.error("Error restoring challenge", e);
      alert("Failed to restore challenge.");
    }
  };

  const handlePermanentlyDeleteChallenge = async (challenge: any) => {
    try {
      if (adminPermissions?.canManageChallenges && challenge.creatorId !== user?.uid) {
          await setDoc(doc(db, 'challenges', challenge.id), { permanentlyDeletedByAdmin: true }, { merge: true });
      } else if (challenge.visibility === 'global' && challenge.approvalStatus === 'approved') {
          await setDoc(doc(db, 'challenges', challenge.id), { permanentlyDeletedByCreator: true }, { merge: true });
      } else {
          await deleteDoc(doc(db, 'challenges', challenge.id));
      }
      await fetchAnnouncement();
      console.log('Challenge permanently deleted');
    } catch (e) {
      console.error("Error permanently deleting challenge", e);
      alert("Failed to permanently delete challenge.");
    }
  };

  return useMemo(() => ({
    dismissedChallenges,
    dismissChallenge,
    unhideChallenge,
    restoreChallenges,
    handleApproveChallenge,
    handleRejectChallenge,
    handleDeleteChallenge,
    handlePinChallenge,
    handleRestoreChallenge,
    handlePermanentlyDeleteChallenge,
  }), [dismissedChallenges]);
}
