import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Users, RefreshCw, Trash2, Zap, Flag, Eye, EyeOff } from 'lucide-react';
import { useAppStateCtx, useUserProfileCtx, usePublicSettingsCtx } from '../../context/AppContext';
import { YptChallenge, YptDailyDaySnapshot } from '../../types/yptTypes';
import {
  softDeleteYptChallenge,
  reopenYptChallenge,
  getRegisteredUserYptList,
  YptUserEntry,
  getAllDailySnapshots,
} from '../../services/yptService';
import { useYptStore } from '../../store/useYptStore';
import { CreateYptChallengeModal } from './ypt/CreateYptChallengeModal';
import { YptChallengeDetail } from './ypt/YptChallengeDetail';
import { YptRecycleBinModal } from './ypt/YptRecycleBinModal';
import { ConfirmDeleteModal } from './ypt/ConfirmDeleteModal';
import { getLocalYmd } from '../../utils/yptUtils';
import {
  YptGlobalStudyTab,
  GlobalDateFilter,
  GlobalMemberStat,
  computeGlobalLeaderboardData,
} from './ypt/hub/YptGlobalStudyTab';
import { YptActiveChallengesTab } from './ypt/hub/YptActiveChallengesTab';
import { YptCompletedChallengesTab, YptTeamRankingsTab } from './ypt/hub/YptCompletedChallengesTab';

export type { GlobalMemberStat };

type SubViewTab = 'global' | 'challenges' | 'completed' | 'leaderboard';

export function YptHubView() {
  const { isOwner } = useAppStateCtx();
  const { profile: userProfile } = useUserProfileCtx();
  const { hiddenYptTabs = [] } = usePublicSettingsCtx();

  const isYptAdmin = Boolean(
    isOwner ||
    userProfile?.role === 'owner' ||
    userProfile?.permissions?.canManageYpt === true
  );

  const canManageYptChallenges = isYptAdmin;

  const [localHiddenTabs, setLocalHiddenTabs] = useState<string[]>(hiddenYptTabs);

  useEffect(() => {
    if (hiddenYptTabs) {
      setLocalHiddenTabs(hiddenYptTabs);
    }
  }, [hiddenYptTabs]);

  // Real-time Firestore sync on both sources so all accounts update instantly
  useEffect(() => {
    let unsub1: any;
    let unsub2: any;

    const setupRealtimeSync = async () => {
      try {
        const { onSnapshot, doc } = await import('firebase/firestore');
        const { db } = await import('../../services/firebase');

        unsub1 = onSnapshot(doc(db, 'yptChallenges', 'hub_settings'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data.hiddenYptTabs)) {
              setLocalHiddenTabs(data.hiddenYptTabs);
            }
          }
        }, (err) => {
          if (err.code !== 'permission-denied') console.warn('yptChallenges config sub:', err);
        });

        unsub2 = onSnapshot(doc(db, 'system', 'settings'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data.hiddenYptTabs)) {
              setLocalHiddenTabs(data.hiddenYptTabs);
            }
          }
        }, (err) => {
          if (err.code !== 'permission-denied') console.warn('system settings sub:', err);
        });
      } catch (err) {
        console.error('Failed to setup hidden tabs sync:', err);
      }
    };

    setupRealtimeSync();

    return () => {
      if (unsub1) unsub1();
      if (unsub2) unsub2();
    };
  }, []);

  const isTabHidden = (tabId: SubViewTab) => localHiddenTabs.includes(tabId);
  const canUserSeeTab = (tabId: SubViewTab) => !isTabHidden(tabId) || isOwner || isYptAdmin;

  const toggleHideTab = async (tabId: SubViewTab, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isOwner) return;

    const nextHidden = localHiddenTabs.includes(tabId)
      ? localHiddenTabs.filter((t) => t !== tabId)
      : [...localHiddenTabs, tabId];

    setLocalHiddenTabs(nextHidden);

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../../services/firebase');
      await Promise.allSettled([
        setDoc(doc(db, 'yptChallenges', 'hub_settings'), { hiddenYptTabs: nextHidden }, { merge: true }),
        setDoc(doc(db, 'system', 'settings'), { hiddenYptTabs: nextHidden }, { merge: true }),
      ]);
    } catch (err) {
      console.error('Failed to update hidden YPT tabs:', err);
    }
  };

  const { isSyncing, lastSyncedAt, isFromCache, forceRefresh } = useYptStore();

  const [challenges, setChallenges] = useState<YptChallenge[]>([]);
  const [timeAgoStr, setTimeAgoStr] = useState<string>('Synced just now');

  useEffect(() => {
    if (!lastSyncedAt) return;
    const updateTime = () => {
      const elapsedSec = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 1000);
      if (elapsedSec < 10) setTimeAgoStr('Synced just now');
      else if (elapsedSec < 60) setTimeAgoStr(`Synced ${elapsedSec}s ago`);
      else {
        const mins = Math.floor(elapsedSec / 60);
        setTimeAgoStr(`Synced ${mins}m ago`);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, [lastSyncedAt]);

  const [allSnapshots, setAllSnapshots] = useState<YptDailyDaySnapshot[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<YptUserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SubViewTab>('global');
  const [dateFilter, setDateFilter] = useState<GlobalDateFilter>('date');
  const [selectedFilterDateYmd, setSelectedFilterDateYmd] = useState<string>(getLocalYmd(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChallenge, setSelectedChallenge] = useState<YptChallenge | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<YptChallenge | null>(null);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [challengeToDelete, setChallengeToDelete] = useState<YptChallenge | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const storeChallenges = useYptStore((s) => s.challenges);
  const storeLoading = useYptStore((s) => s.isLoading);

  useEffect(() => {
    const init = useYptStore.getState().initChallengesListener;
    const cleanup = useYptStore.getState().cleanupListeners;

    init();
    getRegisteredUserYptList().then(setRegisteredUsers).catch(console.error);

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (storeChallenges) {
      setChallenges(storeChallenges);
    }
    if (!storeLoading && storeChallenges !== undefined) {
      setLoading(false);
    }
  }, [storeChallenges, storeLoading]);

  const activeChallenges = challenges.filter((c) => !c.isDeleted && c.status !== 'deleted' && c.status !== 'completed');
  const completedChallenges = challenges.filter((c) => !c.isDeleted && c.status === 'completed');
  const deletedChallenges = challenges.filter((c) => c.isDeleted || c.status === 'deleted');

  const allVisibleChallenges = [...activeChallenges, ...completedChallenges];

  // Fetch dailySnapshots across all visible challenges for the global leaderboard
  const activeIdsKey = allVisibleChallenges.map((c) => c.id).sort().join(',');
  useEffect(() => {
    if (!allVisibleChallenges.length) {
      setAllSnapshots([]);
      return;
    }

    let cancelled = false;
    Promise.all(allVisibleChallenges.map((ch) => getAllDailySnapshots(ch.id)))
      .then((results) => {
        if (!cancelled) {
          setAllSnapshots(results.flat());
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch global snapshots:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [activeIdsKey, lastSyncedAt]);

  // Compute unique registered handles across all active & completed challenges
  const uniqueRegisteredHandles = Array.from(
    new Set(
      allVisibleChallenges.flatMap((c) =>
        (c.teams || []).flatMap((t) => ((t?.memberUids) || []).map((h) => (h || '').replace(/^@/, '').trim().toLowerCase()))
      ).filter(Boolean)
    )
  );

  // Global Leaderboard Aggregator - Unifies member handles under user account starred default handle
  const globalLeaderboard = computeGlobalLeaderboardData(
    registeredUsers,
    activeChallenges,
    allSnapshots,
    dateFilter,
    selectedFilterDateYmd
  );

  const filteredLeaderboard = globalLeaderboard.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().replace(/^@/, '');
    return (
      m.cleanHandle.includes(q) ||
      m.displayHandle.toLowerCase().includes(q) ||
      m.aliases.some((alias) => alias.toLowerCase().includes(q))
    );
  });

  const handleCardDelete = (e: React.MouseEvent, c: YptChallenge) => {
    e.stopPropagation();
    setChallengeToDelete(c);
  };

  const confirmSoftDelete = async () => {
    if (!challengeToDelete) return;
    const targetId = challengeToDelete.id;
    setIsDeleting(true);
    setChallenges((prev) =>
      prev.map((item) =>
        item.id === targetId ? { ...item, isDeleted: true, status: 'deleted' } : item
      )
    );
    try {
      await softDeleteYptChallenge(targetId);
    } catch (err: any) {
      console.error('Failed to soft delete challenge:', err);
      forceRefresh();
    } finally {
      setIsDeleting(false);
      setChallengeToDelete(null);
    }
  };

  const handleCardEdit = (e: React.MouseEvent, c: YptChallenge) => {
    e.stopPropagation();
    setEditingChallenge(c);
    setIsCreateModalOpen(true);
  };

  const handleReopenChallenge = async (e: React.MouseEvent, c: YptChallenge) => {
    e.stopPropagation();
    try {
      await reopenYptChallenge(c.id);
      forceRefresh();
    } catch (err: any) {
      console.error('Failed to reopen challenge:', err);
    }
  };

  const tabDefinitions: {
    id: SubViewTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
  }[] = [
    {
      id: 'global',
      label: `Global Leaderboard (${uniqueRegisteredHandles.length})`,
      icon: Trophy,
      iconColor: 'text-amber-300',
    },
    {
      id: 'challenges',
      label: `Active Challenges (${activeChallenges.length})`,
      icon: Zap,
      iconColor: 'text-amber-400',
    },
    {
      id: 'completed',
      label: `Completed Challenges (${completedChallenges.length})`,
      icon: Flag,
      iconColor: 'text-emerald-400',
    },
    {
      id: 'leaderboard',
      label: 'Team Rankings',
      icon: Users,
      iconColor: 'text-indigo-400',
    },
  ];

  const visibleTabs = tabDefinitions.filter((t) => canUserSeeTab(t.id));

  useEffect(() => {
    if (!canUserSeeTab(activeTab)) {
      if (visibleTabs.length > 0) {
        setActiveTab(visibleTabs[0].id);
      }
    }
  }, [localHiddenTabs, activeTab, isOwner, isYptAdmin, visibleTabs.length]);

  if (selectedChallenge) {
    return (
      <YptChallengeDetail
        challenge={selectedChallenge}
        onBack={() => setSelectedChallenge(null)}
        onRefresh={() => {
          forceRefresh();
        }}
      />
    );
  }

  return (
    <div data-jarvis-section="YPT Challenges" className="space-y-6">
      {/* Top Banner with Action Buttons */}
      <div className="flex flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base sm:text-2xl font-extrabold text-white tracking-tight">YPT Group Challenges</h2>

            {/* Sync Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 border border-slate-700 text-slate-300">
              <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : isFromCache ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
              <span>{isSyncing ? 'Syncing...' : isFromCache ? 'Cached State' : timeAgoStr}</span>
            </div>
          </div>
          <p className="hidden sm:block text-xs text-slate-400 mt-1">Track live YPT study time and compete in group challenges</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => forceRefresh()}
            disabled={isSyncing}
            title="Force Server Sync"
            className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {canManageYptChallenges && (
            <button
              onClick={() => {
                setEditingChallenge(null);
                setIsCreateModalOpen(true);
              }}
              className="px-3 sm:px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher & Bin Icon */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {tabDefinitions
            .filter((tab) => canUserSeeTab(tab.id))
            .map((tab) => {
              const Icon = tab.icon;
              const isHidden = isTabHidden(tab.id);
              const isActive = activeTab === tab.id;

              return (
                <div key={tab.id} className="relative group/tab flex items-center shrink-0">
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${tab.iconColor} shrink-0`} />
                    <span>{tab.label}</span>

                    {isOwner ? (
                      <span
                        role="button"
                        onClick={(e) => toggleHideTab(tab.id, e)}
                        title={
                          isHidden
                            ? 'Unhide this tile for all members'
                            : 'Hide this tile from members'
                        }
                        className={`p-1 rounded-lg transition-all ml-0.5 cursor-pointer flex items-center justify-center ${
                          isActive
                            ? 'text-white/80 hover:text-white hover:bg-indigo-700/60'
                            : isHidden
                              ? 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                              : 'text-slate-400 opacity-60 group-hover/tab:opacity-100 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {isHidden ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </span>
                    ) : isHidden && isYptAdmin ? (
                      <span
                        title="This tile is currently hidden from members"
                        className={`p-1 rounded-lg flex items-center justify-center ml-0.5 ${
                          isActive ? 'text-white/70' : 'text-slate-400'
                        }`}
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
        </div>

        <div className="flex items-center gap-2">
          {canManageYptChallenges && (
            <button
              onClick={() => setIsRecycleBinOpen(true)}
              className="relative p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 transition-colors"
              title="Recycle Bin (Soft Deleted Challenges)"
            >
              <Trash2 className="w-4 h-4" />
              {deletedChallenges.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center border border-white dark:border-slate-900 shadow-sm">
                  {deletedChallenges.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => forceRefresh()}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading YPT challenges...</div>
      ) : visibleTabs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 p-8 sm:p-12 rounded-2xl text-center space-y-3">
          <EyeOff className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
            No Challenge Tabs Visible
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All challenge tiles are currently hidden by the administrator. Please check back later.
          </p>
        </div>
      ) : activeTab === 'global' ? (
        <YptGlobalStudyTab
          activeChallenges={activeChallenges}
          globalLeaderboard={globalLeaderboard}
          filteredLeaderboard={filteredLeaderboard}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          selectedFilterDateYmd={selectedFilterDateYmd}
          setSelectedFilterDateYmd={setSelectedFilterDateYmd}
        />
      ) : activeTab === 'challenges' ? (
        <YptActiveChallengesTab
          activeChallenges={activeChallenges}
          canManageYptChallenges={canManageYptChallenges}
          onCreateClick={() => {
            setEditingChallenge(null);
            setIsCreateModalOpen(true);
          }}
          onSelectChallenge={(c) => setSelectedChallenge(c)}
          onEditChallenge={handleCardEdit}
          onDeleteChallenge={handleCardDelete}
        />
      ) : activeTab === 'completed' ? (
        <YptCompletedChallengesTab
          completedChallenges={completedChallenges}
          canManageYptChallenges={canManageYptChallenges}
          onSelectChallenge={(c) => setSelectedChallenge(c)}
          onReopenChallenge={handleReopenChallenge}
          onDeleteChallenge={handleCardDelete}
        />
      ) : (
        <YptTeamRankingsTab allVisibleChallenges={allVisibleChallenges} />
      )}

      {/* Modals */}
      <CreateYptChallengeModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingChallenge(null);
        }}
        challengeToEdit={editingChallenge}
        onSuccess={() => forceRefresh()}
      />

      <YptRecycleBinModal
        isOpen={isRecycleBinOpen}
        onClose={() => setIsRecycleBinOpen(false)}
        deletedChallenges={deletedChallenges}
        onRefresh={() => forceRefresh()}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(challengeToDelete)}
        title="Move to Recycle Bin?"
        message={`Are you sure you want to delete "${challengeToDelete?.title}"? It will be moved to the Recycle Bin and can be restored anytime.`}
        confirmText="Move to Bin"
        isLoading={isDeleting}
        onConfirm={confirmSoftDelete}
        onClose={() => setChallengeToDelete(null)}
      />
    </div>
  );
}
