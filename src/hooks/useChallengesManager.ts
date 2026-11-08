import { useState, useMemo } from 'react';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useChallengesManager(
    user: any, 
    adminPermissions: any, 
    isOwner: boolean | undefined,
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
      await updateDoc(doc(db, 'challenges', id), { approvalStatus: 'approved' });
      await fetchAnnouncement();
      alert("Challenge approved successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to approve challenge: " + error);
    }
  };

  const handleRejectChallenge = async (id: string) => {
    try {
      await updateDoc(doc(db, 'challenges', id), { approvalStatus: 'rejected' });
      await fetchAnnouncement();
      alert("Challenge rejected successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to reject challenge: " + error);
    }
  };

  const handleDeleteChallenge = async (challenge: any) => {
    try {
      if (isOwner) {
          const participantsSnap = await import('firebase/firestore').then(firestore => firestore.getDocs(firestore.collection(db, 'challenges', challenge.id, 'participants')));
          const batch = await import('firebase/firestore').then(firestore => firestore.writeBatch(db));
          participantsSnap.forEach(docSnap => batch.delete(docSnap.ref));
          await batch.commit();
          await deleteDoc(doc(db, 'challenges', challenge.id));
      } else if (adminPermissions?.canManageChallenges && challenge.creatorId !== user?.uid) {
          await updateDoc(doc(db, 'challenges', challenge.id), { deletedByAdmin: true });
      } else if (challenge.visibility === 'global' && challenge.approvalStatus === 'approved') {
          await updateDoc(doc(db, 'challenges', challenge.id), { deletedByCreator: true });
      } else {
          await updateDoc(doc(db, 'challenges', challenge.id), { status: 'deleted' });
      }
      await fetchAnnouncement();
      console.log('Challenge deleted successfully');
    } catch (e) {
      console.error("Error deleting challenge", e);
      alert("Failed to delete challenge.");
    }
  };

  const handlePinChallenge = async (challenge: any) => {
    if (!adminPermissions?.canManageChallenges) {
        alert("You do not have permission to pin challenges.");
        return;
    }
    
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
    } catch (e: any) {
      console.error("Error pinning challenge", e);
      alert("Error pinning challenge: " + (e.message || e));
    }
  };

  const handleRestoreChallenge = async (challenge: any) => {
    try {
      if (adminPermissions?.canManageChallenges && challenge.creatorId !== user?.uid) {
          await updateDoc(doc(db, 'challenges', challenge.id), { deletedByAdmin: false, permanentlyDeletedByAdmin: false });
      } else {
          await updateDoc(doc(db, 'challenges', challenge.id), { status: 'active', deletedByCreator: false, permanentlyDeletedByCreator: false });
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
      if (isOwner) {
          const participantsSnap = await import('firebase/firestore').then(firestore => firestore.getDocs(firestore.collection(db, 'challenges', challenge.id, 'participants')));
          const batch = await import('firebase/firestore').then(firestore => firestore.writeBatch(db));
          participantsSnap.forEach(docSnap => batch.delete(docSnap.ref));
          await batch.commit();
          await deleteDoc(doc(db, 'challenges', challenge.id));
      } else if (adminPermissions?.canManageChallenges && challenge.creatorId !== user?.uid) {
          await updateDoc(doc(db, 'challenges', challenge.id), { permanentlyDeletedByAdmin: true });
      } else if (challenge.visibility === 'global' && challenge.approvalStatus === 'approved') {
          await updateDoc(doc(db, 'challenges', challenge.id), { permanentlyDeletedByCreator: true });
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
  }), [dismissedChallenges, adminPermissions, isOwner, user?.uid, pinnedChallenges, setPinnedChallenges, fetchAnnouncement]);
}
