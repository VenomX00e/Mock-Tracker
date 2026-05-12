import React from 'react';
import { Flame, Plus, EyeOff, Bell, Trash } from 'lucide-react';
import { useAuthCtx, useSystemDataCtx, useChallengesManagerCtx, useUserProfileCtx, useAppStateCtx } from '../../context/AppContext';
import { useUIStore } from '../../store/uiStore';
import { useMocks } from '../../hooks/useMocks';
import { TasksTile } from '../TasksTile';
import { ChallengeCard } from '../ChallengeCard';

export function ChallengesSection() {
  const { user } = useAuthCtx();
  const { challenges, pinnedChallenges, selectedCategory, deletedChallenges } = useSystemDataCtx();
  const { 
      activeTab, 
      setIsCreateChallengeOpen, 
      setIsHiddenChallengesModalOpen, 
      setIsRequestsModalOpen, 
      setIsChallengeRecycleBinOpen,
      setShowTasksModal
  } = useUIStore();
  const { 
      dismissedChallenges, 
      dismissChallenge, 
      handleDeleteChallenge, 
      handlePinChallenge 
  } = useChallengesManagerCtx();
  const { profile } = useUserProfileCtx();
  const { mocks, updateMock } = useMocks();
  const { adminPermissions, handleUpdateProfileTasks, setEditingChallenge } = useAppStateCtx();

  const handleUpdateReflection = async (id: string, updates: any) => {
    const mockToUpdate = mocks.find(m => m.id === id);
    if (!mockToUpdate) return;
    await updateMock({ ...mockToUpdate, ...updates });
  };

  if (activeTab === 'admin' || (challenges.length === 0 && !user)) {
    return null;
  }

  const handleEditChallenge = (challenge: any) => {
    setIsRequestsModalOpen(false);
    setEditingChallenge(challenge);
    setIsCreateChallengeOpen(true);
  };

  const visibleChallenges = challenges
    .filter(c => {
      const categoryMatch = c.categoryId === selectedCategory || (!c.categoryId && selectedCategory === 'banking');
      const isVisible = categoryMatch && (c.creatorId === user?.uid || !(c.visibility === 'global' && (c.approvalStatus === 'pending' || c.approvalStatus === 'rejected'))) && !dismissedChallenges.includes(c.id);
      if (!isVisible) return false;
      if (activeTab === 'community') return pinnedChallenges.includes(c.id);
      return true;
    })
    .sort((a, b) => {
      const aIdx = pinnedChallenges.indexOf(a.id);
      const bIdx = pinnedChallenges.indexOf(b.id);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return 0;
    });

  const showGrid = visibleChallenges.length > 0 || (activeTab === 'dashboard' && user && profile);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4 mt-6 flex-nowrap w-full">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white flex items-center gap-1 sm:gap-2 min-w-0">
          <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 shrink-0" />
          <span className="truncate">Active Challenges</span>
        </h2>
        {user && (
          <button 
            onClick={() => setIsCreateChallengeOpen(true)}
            className="p-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors ml-1 sm:ml-2 shrink-0" 
            title="Create Challenge"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3 shrink-0">
          {dismissedChallenges.length > 0 && (
            <button 
              onClick={() => setIsHiddenChallengesModalOpen(true)} 
              className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 relative"
              title={`Hidden Challenges (${dismissedChallenges.length})`}
            >
              <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="absolute -top-1 -right-1 bg-slate-500 text-white text-[9px] sm:text-[10px] w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full font-bold">
                {dismissedChallenges.length}
              </span>
            </button>
          )}
          {adminPermissions?.canManageChallenges && challenges.some(c => c.visibility === 'global' && c.approvalStatus === 'pending') && (
            <button
              onClick={() => setIsRequestsModalOpen(true)}
              className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors shrink-0 relative"
              title={`Requests (${challenges.filter(c => c.visibility === 'global' && c.approvalStatus === 'pending').length})`}
            >
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[9px] sm:text-[10px] w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full font-bold">
                {challenges.filter(c => c.visibility === 'global' && c.approvalStatus === 'pending').length}
              </span>
            </button>
          )}
          {user && deletedChallenges.length > 0 && (
            <button
              onClick={() => setIsChallengeRecycleBinOpen(true)}
              className="p-1.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-full transition-colors flex items-center justify-center relative shrink-0"
              title={`Recycle Bin (${deletedChallenges.length})`}
            >
              <Trash className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] sm:text-[10px] w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full font-bold">
                {deletedChallenges.length}
              </span>
            </button>
          )}
        </div>
      </div>
      {showGrid ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeTab === 'dashboard' && user && profile && (
            <TasksTile 
              mocks={mocks} 
              profileTasks={profile?.tasks || []}
              onUpdateReflection={handleUpdateReflection} 
              onUpdateProfileTasks={handleUpdateProfileTasks}
              onOpenTasks={() => setShowTasksModal(true)} 
            />
          )}
          {visibleChallenges.map(challenge => (
            <ChallengeCard 
              key={challenge.id} 
              challenge={{ ...challenge, isPinned: pinnedChallenges.includes(challenge.id) }}
              onEdit={handleEditChallenge}
              onDelete={handleDeleteChallenge}
              onDismiss={dismissChallenge}
              onPin={handlePinChallenge}
              isAdmin={adminPermissions?.canManageChallenges}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <p className="text-sm">No active challenges available. Click the + button to create one!</p>
        </div>
      )}
    </div>
  );
}
