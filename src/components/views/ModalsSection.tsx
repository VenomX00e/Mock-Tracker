import React, { useState } from 'react';
import { useAuthCtx, useUserProfileCtx, useSystemDataCtx, useAppStateCtx, useChallengesManagerCtx } from '../../context/AppContext';
import { useUIStore } from '../../store/uiStore';
import { useMocks } from '../../hooks/useMocks';
import { AnimatePresence } from 'motion/react';
import AddMockDialog from '../AddMockDialog';
import ProfileDialog from '../ProfileDialog';
import { PublicProfileDialog } from '../PublicProfileDialog';
import ChallengeRequestsDialog from '../ChallengeRequestsDialog';
import ChallengeRecycleBinDialog from '../ChallengeRecycleBinDialog';
import HiddenChallengesDialog from '../HiddenChallengesDialog';
import AdminDialog from '../AdminDialog';
import { EditCountdownDialog } from '../EditCountdownDialog';
import AddLiveMockDialog from '../AddLiveMockDialog';
import { CreateChallengeDialog } from '../CreateChallengeDialog';
import { ApiKeyModal } from '../ApiKeyModal';
import { MockScore } from '../../types';

export function ModalsSection() {
  const { user } = useAuthCtx();
  const { profile } = useUserProfileCtx();
  const {
      isAddModalOpen, setIsAddModalOpen,
      isProfileModalOpen, setIsProfileModalOpen,
      activePublicProfile, setActivePublicProfile,
      isRequestsModalOpen, setIsRequestsModalOpen,
      isChallengeRecycleBinOpen, setIsChallengeRecycleBinOpen,
      isHiddenChallengesModalOpen, setIsHiddenChallengesModalOpen,
      isAdminModalOpen, setIsAdminModalOpen,
      isAddLiveMockOpen, setIsAddLiveMockOpen,
      isCreateChallengeOpen, setIsCreateChallengeOpen,
      isApiModalOpen, setIsApiModalOpen,
      adminTab, setAdminTab,
      adminEditNotice, setAdminEditNotice,
      adminEditCountdown, setAdminEditCountdown,
      theme, setTheme
  } = useUIStore();
  const { challenges, deletedChallenges, selectedCategory, categories } = useSystemDataCtx();
  const {
      dismissedChallenges,
      unhideChallenge,
      handleApproveChallenge,
      handleRejectChallenge,
      handleRestoreChallenge,
      handlePermanentlyDeleteChallenge
  } = useChallengesManagerCtx();
  const { addMock, updateMock } = useMocks();
  const { mockToEdit, setMockToEdit, editingChallenge, setEditingChallenge, adminPermissions, isOwner, isAdmin } = useAppStateCtx();

  // Local state for API key input
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('geminiApiKey') || '');

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setTimeout(() => setMockToEdit(undefined), 300);
  };

  const handleCloseCreateChallenge = () => {
    setIsCreateChallengeOpen(false);
    setTimeout(() => setEditingChallenge(null), 300);
  };

  const handleEditChallenge = (challenge: any) => {
    setIsRequestsModalOpen(false);
    setEditingChallenge(challenge);
    setIsCreateChallengeOpen(true);
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('geminiApiKey', apiKeyInput);
    setIsApiModalOpen(false);
  };

  const handleMuteUser = async (userId: string, isMuted: boolean) => {
    if (activePublicProfile?.email === 'mrityunjoyk29@gmail.com' && !isOwner) {
      alert("You cannot mute the owner.");
      return;
    }
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('../../services/firebase');
    await setDoc(doc(db, 'users', userId), { isMuted }, { merge: true });
    setActivePublicProfile((prev: any) => prev ? { ...prev, isMuted } : null);
  };

  const handleBanUser = async (userId: string, isBanned: boolean) => {
    if (activePublicProfile?.email === 'mrityunjoyk29@gmail.com' && !isOwner) {
      alert("You cannot ban the owner.");
      return;
    }
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('../../services/firebase');
    await setDoc(doc(db, 'users', userId), { isBanned }, { merge: true });
    setActivePublicProfile((prev: any) => prev ? { ...prev, isBanned } : null);
  };

  return (
    <>
      {/* Add Mock Modal */}
      {user && (
        <AddMockDialog 
          isOpen={isAddModalOpen} 
          onClose={handleCloseModal} 
          initialMock={mockToEdit}
          categories={categories}
          categoryId={selectedCategory}
          onSave={async (mock: MockScore) => {
            if (mockToEdit?.id) {
              await updateMock(mock);
            } else {
              await addMock(mock);
            }
            handleCloseModal();
          }} 
        />
      )}

      {user && (
        <ProfileDialog
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          theme={theme}
          setTheme={setTheme}
          categories={categories}
        />
      )}

      <AnimatePresence>
        {activePublicProfile && (
           <PublicProfileDialog
              isOpen={true}
              onClose={() => setActivePublicProfile(null)}
              profile={activePublicProfile}
              isCurrentUser={user?.uid === activePublicProfile.userId}
              onEditProfile={() => setIsProfileModalOpen(true)}
              isAdmin={adminPermissions?.canManageUsers}
              isViewerOwner={isOwner}
              onMuteUser={handleMuteUser}
              onBanUser={handleBanUser}
           />
        )}
      </AnimatePresence>

      {adminPermissions?.canManageChallenges && (
        <ChallengeRequestsDialog
          isOpen={isRequestsModalOpen}
          onClose={() => setIsRequestsModalOpen(false)}
          challenges={challenges}
          onApprove={handleApproveChallenge}
          onReject={handleRejectChallenge}
          onEdit={handleEditChallenge}
        />
      )}

      {user && (
        <ChallengeRecycleBinDialog
          isOpen={isChallengeRecycleBinOpen}
          onClose={() => setIsChallengeRecycleBinOpen(false)}
          deletedChallenges={deletedChallenges}
          onRestore={handleRestoreChallenge}
          onPermanentlyDelete={handlePermanentlyDeleteChallenge}
          isAdmin={adminPermissions?.canManageChallenges}
        />
      )}

      {user && (
        <HiddenChallengesDialog
          isOpen={isHiddenChallengesModalOpen}
          onClose={() => setIsHiddenChallengesModalOpen(false)}
          hiddenChallenges={challenges.filter((c: any) => {
            const categoryMatch = c.categoryId === selectedCategory || (!c.categoryId && selectedCategory === 'banking');
            return categoryMatch && dismissedChallenges.includes(c.id);
          })}
          onRestore={unhideChallenge}
        />
      )}

      {isAdmin && (
        <AdminDialog 
          isOpen={isAdminModalOpen}
          isOwner={isOwner}
          adminPermissions={adminPermissions}
          currentCategory={selectedCategory}
          onClose={() => {
            setIsAdminModalOpen(false);
            setAdminEditNotice(null);
            setAdminEditCountdown(null);
          }}
          initialTab={adminTab as any}
          editNoticeData={adminEditNotice}
          editCountdownData={adminEditCountdown}
          categories={categories}
        />
      )}

      {isAdmin && (
        <EditCountdownDialog
          isOpen={!isAdminModalOpen && !!adminEditCountdown}
          countdownData={adminEditCountdown}
          onClose={() => setAdminEditCountdown(null)}
        />
      )}

      {user && (
        <AddLiveMockDialog
           isOpen={isAddLiveMockOpen}
           onClose={() => setIsAddLiveMockOpen(false)}
           onSuccess={() => setIsAddLiveMockOpen(false)}
           categoryId={selectedCategory}
           categories={categories}
        />
      )}

      {user && (
        <CreateChallengeDialog
          isOpen={isCreateChallengeOpen}
          onClose={handleCloseCreateChallenge}
          uid={user.uid}
          initialData={editingChallenge}
          categoryId={selectedCategory}
          categories={categories}
          isAdmin={isAdmin}
          isOwner={isOwner}
        />
      )}

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        apiKeyInput={apiKeyInput}
        setApiKeyInput={setApiKeyInput}
        onSave={handleSaveApiKey}
      />
    </>
  );
}
