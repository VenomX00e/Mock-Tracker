import React, { useState, useEffect } from 'react';
import { Trophy, Plus, FileImage, Users, User, Award, Sparkles, RefreshCw, ChevronLeft, ChevronRight, Calendar, Settings, Trash2, Search, Clock, UserCheck, Crown, Zap, CheckCircle2, RotateCcw, Flag, Eye, EyeOff } from 'lucide-react';
import { useAppStateCtx, useUserProfileCtx, usePublicSettingsCtx } from '../../context/AppContext';
import { YptChallenge, YptSubmissionLog } from '../../types/yptTypes';
import { getAllYptChallenges, getYptSubmissionLogs, softDeleteYptChallenge, reopenYptChallenge, getRegisteredUserYptList, YptUserEntry, getDeduplicatedDailyMemberStats, subscribeToYptSubmissions, getYptSyncInterval } from '../../services/yptService';
import { useYptStore } from '../../store/useYptStore';
import { CreateYptChallengeModal } from './ypt/CreateYptChallengeModal';
import { YptUploadModal } from './ypt/YptUploadModal';
import { YptChallengeDetail } from './ypt/YptChallengeDetail';
import { YptRecycleBinModal } from './ypt/YptRecycleBinModal';
import { ConfirmDeleteModal } from './ypt/ConfirmDeleteModal';
import { YptAutoSyncModal } from './ypt/YptAutoSyncModal';
import { formatStudyDuration, areYptHandlesMatching, normalizeHandle, extractAlpha, formatDisplayYmd } from '../../utils/yptUtils';

type SubViewTab = 'global' | 'challenges' | 'completed' | 'leaderboard';
type GlobalDateFilter = 'date' | 'allTime';

export interface GlobalMemberStat {
  cleanHandle: string;
  displayHandle: string;
  periodHours: number;
  periodXP: number;
  totalHours: number;
  totalXP: number;
  submissionCount: number;
}

function getLocalYmd(dateInput: Date | string | number): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatStudyHours(hours: number): string {
  if (!hours || hours <= 0) return '0h 00m';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

export function YptHubView() {
  const { isOwner, isAdmin } = useAppStateCtx();
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
  const [allSubmissions, setAllSubmissions] = useState<YptSubmissionLog[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<YptUserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [activeTab, setActiveTab] = useState<SubViewTab>('global');
  const [dateFilter, setDateFilter] = useState<GlobalDateFilter>('date');
  const [selectedFilterDateYmd, setSelectedFilterDateYmd] = useState<string>(getLocalYmd(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChallenge, setSelectedChallenge] = useState<YptChallenge | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<YptChallenge | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isAutoSyncModalOpen, setIsAutoSyncModalOpen] = useState(false);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState<number>(15);
  const [challengeToDelete, setChallengeToDelete] = useState<YptChallenge | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    getYptSyncInterval().then((mins) => {
      if (mins && !isNaN(mins)) setSyncIntervalMinutes(mins);
    }).catch(() => {});
  }, []);

  const storeChallenges = useYptStore((s) => s.challenges);
  const storeLoading = useYptStore((s) => s.isLoading);

  useEffect(() => {
    const init = useYptStore.getState().initChallengesListener;
    const cleanup = useYptStore.getState().cleanupListeners;

    init(); // Starts Firestore onSnapshot listener
    getRegisteredUserYptList().then(setRegisteredUsers).catch(console.error);

    return () => {
      cleanup(); // Safely closes listener when leaving tab
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

  // Real-time listener for submission logs across all active & completed challenges
  const activeIdsKey = allVisibleChallenges.map((c) => c.id).sort().join(',');
  useEffect(() => {
    if (!allVisibleChallenges.length) {
      setAllSubmissions([]);
      setLoadingSubmissions(false);
      return;
    }

    setLoadingSubmissions(true);
    const unsubs: (() => void)[] = [];
    const submissionsMap = new Map<string, YptSubmissionLog[]>();

    allVisibleChallenges.forEach((ch) => {
      const unsub = subscribeToYptSubmissions(ch.id, (logs) => {
        submissionsMap.set(ch.id, logs);
        const combined = Array.from(submissionsMap.values()).flat();
        setAllSubmissions(combined);
        setLoadingSubmissions(false);
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [activeIdsKey]);

  // Compute unique registered handles across all active & completed challenges
  const uniqueRegisteredHandles = Array.from(
    new Set(
      allVisibleChallenges.flatMap((c) =>
        (c.teams || []).flatMap((t) => ((t?.memberUids) || []).map((h) => (h || '').replace(/^@/, '').trim().toLowerCase()))
      ).filter(Boolean)
    )
  );

  // Global Leaderboard Aggregator - Unifies member handles under user account starred default handle
  const getGlobalLeaderboardData = (): (GlobalMemberStat & { aliases: string[] })[] => {
    const todayObj = new Date();
    const todayYmd = getLocalYmd(todayObj);

    const yesterdayObj = new Date(todayObj);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayYmd = getLocalYmd(yesterdayObj);

    const sevenDaysAgoObj = new Date(todayObj);
    sevenDaysAgoObj.setDate(sevenDaysAgoObj.getDate() - 6);
    const sevenDaysAgoYmd = getLocalYmd(sevenDaysAgoObj);

    // Build alias map and pre-initialize registered members in membersMap
    const aliasToUserMap = new Map<string, { userKey: string; primaryDisplayHandle: string; allAliases: string[] }>();
    const membersMap = new Map<string, GlobalMemberStat & { aliases: string[] }>();

    registeredUsers.forEach((u) => {
      const allAliases = Array.isArray(u.yptNames) ? [...u.yptNames] : [];
      if (u.displayName && !allAliases.includes(u.displayName)) {
        allAliases.push(u.displayName);
      }
      if (u.defaultYptHandle && !allAliases.includes(u.defaultYptHandle)) {
        allAliases.push(u.defaultYptHandle);
      }
      if (allAliases.length === 0) return;

      let primaryDisplay = u.defaultYptHandle;
      if (!primaryDisplay && allAliases.length > 0) {
        primaryDisplay = allAliases[0];
      }
      if (!primaryDisplay) {
        primaryDisplay = u.displayName || u.uid;
      }
      primaryDisplay = primaryDisplay.replace(/^@/, '').trim();

      const userKey = u.uid;

      membersMap.set(userKey, {
        cleanHandle: userKey,
        displayHandle: primaryDisplay,
        periodHours: 0,
        periodXP: 0,
        totalHours: 0,
        totalXP: 0,
        submissionCount: 0,
        aliases: allAliases,
      });

      const addAliasToMap = (key: string) => {
        if (!key) return;
        if (!aliasToUserMap.has(key)) {
          aliasToUserMap.set(key, {
            userKey,
            primaryDisplayHandle: primaryDisplay!,
            allAliases,
          });
        }
      };

      // Map UID directly
      addAliasToMap(u.uid.toLowerCase());

      allAliases.forEach((alias) => {
        if (!alias) return;
        const clean = alias.replace(/^@/, '').trim().toLowerCase();
        addAliasToMap(clean);

        const norm = normalizeHandle(alias);
        addAliasToMap(norm);

        const noSpace = norm.replace(/\s+/g, '');
        addAliasToMap(noSpace);

        const alpha = extractAlpha(alias);
        if (alpha && alpha.length >= 2) {
          addAliasToMap(alpha);
        }
      });
    });

    // Helper to get registered member record (returns null for non-registered handles)
    const getOrInitMemberRecord = (rawHandle?: string, matchedUid?: string) => {
      if (!rawHandle && !matchedUid) return null;

      if (matchedUid && membersMap.has(matchedUid)) {
        return membersMap.get(matchedUid)!;
      }

      if (rawHandle) {
        const cleanHandle = rawHandle.replace(/^@/, '').trim().toLowerCase();
        let registered = aliasToUserMap.get(cleanHandle);
        if (!registered) {
          const norm = normalizeHandle(rawHandle);
          registered = aliasToUserMap.get(norm);
        }
        if (!registered) {
          const noSpace = normalizeHandle(rawHandle).replace(/\s+/g, '');
          registered = aliasToUserMap.get(noSpace);
        }
        if (!registered) {
          const alpha = extractAlpha(rawHandle);
          if (alpha && alpha.length >= 2) {
            registered = aliasToUserMap.get(alpha);
          }
        }

        if (registered) {
          return membersMap.get(registered.userKey) || null;
        }

        // Fallback multi-tier match
        for (const userEntry of registeredUsers) {
          const userKey = userEntry.uid;
          const userAliases = Array.isArray(userEntry.yptNames) ? [...userEntry.yptNames] : [];
          if (userEntry.displayName) userAliases.push(userEntry.displayName);

          for (const alias of userAliases) {
            if (areYptHandlesMatching(alias, rawHandle, userKey, matchedUid)) {
              return membersMap.get(userKey) || null;
            }
          }
        }
      }

      return null;
    };

    // 1. Index registered members across all active challenges
    activeChallenges.forEach((c) => {
      (c.teams || []).forEach((t) => {
        (t.memberUids || []).forEach((rawHandle) => {
          getOrInitMemberRecord(rawHandle);
        });
      });
    });

    // 2. Scan deduplicated submissions across all challenges (same-day replacement per member & challenge)
    const deduplicatedStats = getDeduplicatedDailyMemberStats(allSubmissions);

    deduplicatedStats.forEach((dStat) => {
      const subYmd = dStat.dateYmd;

      let isPeriodMatch = false;
      if (dateFilter === 'allTime') {
        isPeriodMatch = true;
      } else {
        isPeriodMatch = subYmd === selectedFilterDateYmd;
      }

      const stat = getOrInitMemberRecord(dStat.memberHandle, dStat.matchedUid);
      if (!stat) return;

      stat.totalHours += dStat.hoursStudied || 0;
      stat.submissionCount += 1;

      if (isPeriodMatch) {
        stat.periodHours += dStat.hoursStudied || 0;
      }
    });

    // 3. Convert to array and round floats nicely (1 study hour = 1 XP)
    const result = Array.from(membersMap.values()).map((stat) => {
      const periodHours = Math.round(stat.periodHours * 100) / 100;
      const totalHours = Math.round(stat.totalHours * 100) / 100;
      return {
        ...stat,
        periodHours,
        periodXP: periodHours,
        totalHours,
        totalXP: totalHours,
      };
    });

    // 4. Sorting: If dateFilter is allTime, sort by totalHours/totalXP.
    // If dateFilter is period (today, yesterday, last7days), sort by periodHours/periodXP first, then totalHours.
    result.sort((a, b) => {
      if (dateFilter === 'allTime') {
        if (b.totalHours !== a.totalHours) return b.totalHours - a.totalHours;
        return b.periodHours - a.periodHours;
      } else {
        if (b.periodHours !== a.periodHours) return b.periodHours - a.periodHours;
        return b.totalHours - a.totalHours;
      }
    });

    return result;
  };

  const globalLeaderboard = getGlobalLeaderboardData();

  const totalGlobalPeriodHours = Math.round(globalLeaderboard.reduce((acc, m) => acc + (dateFilter === 'allTime' ? m.totalHours : m.periodHours), 0) * 100) / 100;
  const activeScholarsCount = globalLeaderboard.filter((m) => (dateFilter === 'allTime' ? m.totalHours > 0 : m.periodHours > 0)).length;
  const topScholar = globalLeaderboard.length > 0 && (dateFilter === 'allTime' ? globalLeaderboard[0].totalHours > 0 : globalLeaderboard[0].periodHours > 0) ? globalLeaderboard[0] : null;

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
    // Optimistically update local state
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

  // Automatically switch active tab if current tab is hidden and cannot be seen by the user
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

            {/* Auto-Sync Interval Pill / Trigger */}
            {canManageYptChallenges && (
              <button
                type="button"
                onClick={() => setIsAutoSyncModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/70 text-indigo-300 transition-colors cursor-pointer"
                title="Configure background auto-sync frequency"
              >
                <Clock className="w-3 h-3 text-indigo-400" />
                <span>{syncIntervalMinutes}m sync</span>
              </button>
            )}
          </div>
          <p className="hidden sm:block text-xs text-slate-400 mt-1">Track study time, complete group challenges, and upload daily logs</p>
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

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 sm:px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <FileImage className="w-4 h-4" />
            <span>Upload</span>
          </button>
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

                    {/* Visibility Icon: Eye if not hidden, Cross-Eye (EyeOff) if hidden */}
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
          {/* Recycle Bin Button */}
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
        <div className="space-y-6">
          {/* Global Arena Header Banner */}
          <div className="bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950 border border-indigo-500/20 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Global YPT Arena
                  </span>
                  <span className="text-[11px] sm:text-xs text-indigo-200/80 font-medium">
                    Real-time study analytics across all challenges
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white mt-1">
                  Global Individual Leaderboard
                </h2>
              </div>

              {/* Filter Controls: Handle Search Input & Date Filter Toggles */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full md:w-auto">
                {/* Search Input */}
                <div className="relative w-full sm:w-auto">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by @handle..."
                    className="pl-8 pr-3 py-1.5 text-[11px] sm:text-xs bg-slate-800/90 border border-indigo-500/30 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400 w-full sm:w-44 transition-all"
                  />
                </div>

                {/* Date Filter Toggle Control with Arrow Navigation */}
                {(() => {
                  const earliestStartDateYmd = activeChallenges.reduce((earliest, c) => {
                    if (!c.startDate) return earliest;
                    const raw = String(c.startDate).trim();
                    const ymd = raw.split('T')[0];
                    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd) && ymd < earliest) return ymd;
                    return earliest;
                  }, getLocalYmd(new Date(Date.now() - 60 * 86400000)));

                  const minAllowedDateYmd = earliestStartDateYmd;
                  const todayYmd = getLocalYmd(new Date());

                  const isPrevDateDisabled = selectedFilterDateYmd <= minAllowedDateYmd;
                  const isNextDateDisabled = selectedFilterDateYmd >= todayYmd;

                  const getDayOffsetFromToday = (dateYmd: string): number => {
                    const todayStr = getLocalYmd(new Date());
                    if (dateYmd === todayStr) return 0;
                    const [tY, tM, tD] = todayStr.split('-').map(Number);
                    const [sY, sM, sD] = dateYmd.split('-').map(Number);
                    const tDate = new Date(tY, tM - 1, tD);
                    const sDate = new Date(sY, sM - 1, sD);
                    const diffMs = sDate.getTime() - tDate.getTime();
                    return Math.round(diffMs / (1000 * 60 * 60 * 24));
                  };

                  const getFilterDateLabel = (dateYmd: string): string => {
                    const offset = getDayOffsetFromToday(dateYmd);
                    if (offset === 0) return '☀️ Today';
                    if (offset === -1) return '📅 Yesterday';

                    const [y, m, d] = dateYmd.split('-').map(Number);
                    const dateObj = new Date(y, m - 1, d);
                    const formatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return `📅 ${formatted}`;
                  };

                  return (
                    <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-indigo-500/30 text-xs font-bold shrink-0">
                      <div
                        className={`flex items-center rounded-lg transition-all ${
                          dateFilter === 'date'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (!isPrevDateDisabled) {
                              const [y, m, d] = selectedFilterDateYmd.split('-').map(Number);
                              const dateObj = new Date(y, m - 1, d);
                              dateObj.setDate(dateObj.getDate() - 1);
                              const nextYmd = getLocalYmd(dateObj);
                              if (nextYmd >= minAllowedDateYmd) {
                                setSelectedFilterDateYmd(nextYmd);
                                setDateFilter('date');
                              }
                            }
                          }}
                          disabled={isPrevDateDisabled}
                          className="p-1 hover:bg-indigo-700 rounded-l-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={`Previous day (${minAllowedDateYmd})`}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDateFilter('date')}
                          className="px-2 py-1 text-[11px] sm:text-xs font-bold whitespace-nowrap cursor-pointer"
                        >
                          {getFilterDateLabel(selectedFilterDateYmd)}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!isNextDateDisabled) {
                              const [y, m, d] = selectedFilterDateYmd.split('-').map(Number);
                              const dateObj = new Date(y, m - 1, d);
                              dateObj.setDate(dateObj.getDate() + 1);
                              const nextYmd = getLocalYmd(dateObj);
                              if (nextYmd <= todayYmd) {
                                setSelectedFilterDateYmd(nextYmd);
                                setDateFilter('date');
                              }
                            }
                          }}
                          disabled={isNextDateDisabled}
                          className="p-1 hover:bg-indigo-700 rounded-r-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Next day (up to Today)"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDateFilter('allTime')}
                        className={`px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                          dateFilter === 'allTime'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        🏆 All-Time
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Leaderboard Member Cards Grid */}
          {filteredLeaderboard.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center space-y-2">
              <Trophy className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {searchQuery ? `No members found matching "@${searchQuery}"` : 'No study data available for this period'}
              </p>
              <p className="text-[11px] text-slate-400">
                Try changing the date filter or searching for another handle.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredLeaderboard.map((member) => {
                // True rank (1-indexed) in full globalLeaderboard array (sorted by cumulative totalHours)
                const rank = globalLeaderboard.findIndex((m) => m.cleanHandle === member.cleanHandle) + 1;

                const isRank1 = rank === 1 && member.totalHours > 0;
                const isRank2 = rank === 2 && member.totalHours > 0;
                const isRank3 = rank === 3 && member.totalHours > 0;

                return (
                  <div
                    key={member.cleanHandle}
                    className={`p-3 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-2 sm:gap-3 ${
                      isRank1
                        ? 'bg-amber-500/15 dark:bg-amber-500/20 border-amber-400 dark:border-amber-500/80 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/30'
                        : isRank2
                        ? 'bg-slate-200/60 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 shadow-2xs'
                        : isRank3
                        ? 'bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/30 dark:border-orange-500/40 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Rank + Handle Info */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {/* Rank Position Pill */}
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl shrink-0 flex items-center justify-center font-black text-[11px] sm:text-xs font-mono shadow-2xs ${
                          isRank1
                            ? 'bg-amber-400 text-amber-950 shadow-amber-500/30'
                            : isRank2
                            ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                            : isRank3
                            ? 'bg-orange-400 text-orange-950'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        #{rank}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white font-mono truncate">
                            @{member.displayHandle}
                          </span>

                          {isRank1 ? (
                            <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300 font-extrabold border border-amber-400/30 shrink-0 flex items-center justify-center">
                              👑
                            </span>
                          ) : isRank2 ? (
                            <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-slate-300/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold border border-slate-400/30 shrink-0 flex items-center justify-center">
                              🥈
                            </span>
                          ) : isRank3 ? (
                            <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-700 dark:text-orange-300 font-extrabold border border-orange-500/30 shrink-0 flex items-center justify-center">
                              🥉
                            </span>
                          ) : null}
                        </div>

                        {/* Study Duration Details */}
                        <div className="text-[10px] sm:text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 flex flex-wrap sm:flex-nowrap items-center gap-1 sm:gap-2">
                          <span>
                            {dateFilter === 'date' ? (selectedFilterDateYmd === getLocalYmd(new Date()) ? 'Today' : selectedFilterDateYmd) : 'Period'}:{' '}
                            <strong className="font-mono">{formatStudyHours(member.periodHours)}</strong>
                          </span>
                          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                          <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-[11px]">
                            Total: <strong className="font-mono">{formatStudyHours(member.totalHours)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Metrics: Earned XP */}
                    <div className="flex flex-col items-end text-right shrink-0 font-mono space-y-0.5">
                      <div className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400">
                        Total: {member.totalXP} XP
                      </div>
                      <div className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        +{member.periodXP} XP {dateFilter === 'date' ? (selectedFilterDateYmd === getLocalYmd(new Date()) ? 'today' : selectedFilterDateYmd) : 'period'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'challenges' ? (
        activeChallenges.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-2xl text-center space-y-3">
            <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400 mx-auto" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">No Active YPT Challenges</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 max-w-sm mx-auto">
              Create your first team study challenge to start tracking YPT group study hours automatically!
            </p>
            {canManageYptChallenges && (
              <button
                onClick={() => {
                  setEditingChallenge(null);
                  setIsCreateModalOpen(true);
                }}
                className="px-3.5 sm:px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all"
              >
                Create First Challenge
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {activeChallenges.map((c) => {
              const isSolo = c.mode === 'individual';
              const participantCount = isSolo ? (c.participants?.length || 0) : (c.teams?.reduce((acc, t) => acc + (t.memberUids?.length || 0), 0) || 0);

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedChallenge(c)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 p-3.5 sm:p-5 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                          {c.status}
                        </span>
                        <span className={`px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold border uppercase tracking-wider flex items-center gap-1 ${
                          isSolo
                            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25'
                            : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                        }`}>
                          {isSolo ? <User className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                          <span>{isSolo ? 'Individual' : 'Team Battle'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          {formatDisplayYmd(c.startDate)}
                        </span>
                        {/* Action buttons on card */}
                        {canManageYptChallenges && (
                          <>
                            <button
                              onClick={(e) => handleCardEdit(e, c)}
                              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit Settings"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleCardDelete(e, c)}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Move to Recycle Bin"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {c.title}
                    </h3>
                    {c.description && (
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {c.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] sm:text-xs">
                    <div className="flex items-center gap-2.5 sm:gap-3 text-slate-600 dark:text-slate-400 font-medium">
                      {isSolo ? (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-purple-500 shrink-0" /> {c.participants?.length || 0} Participants
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> {c.teams?.length || 0} Teams
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" /> {c.rules?.pointsPerInterval ?? c.rules?.pointsPerStudyHour ?? 1} XP/hr
                      </span>
                    </div>

                    <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                      View <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === 'completed' ? (
        completedChallenges.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-2xl text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500/60 mx-auto" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">No Completed Challenges Yet</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 max-w-sm mx-auto">
              When an active challenge is concluded and results are published by an admin, it will appear here with final standings and awards.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {completedChallenges.map((c) => {
              const isSolo = c.mode === 'individual';
              const teamsList = c.teams || [];
              const winningTeam = !isSolo ? (teamsList.find((t) => t.id === c.winningTeamId) || (teamsList.length > 0 ? teamsList.slice().sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))[0] : null)) : null;
              const mvpHandle = c.finalMvpHandle ? `@${c.finalMvpHandle.replace(/^@/, '')}` : null;
              const soloWinnerHandle = c.winningParticipantHandle ? `@${c.winningParticipantHandle.replace(/^@/, '')}` : mvpHandle;

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedChallenge(c)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 p-3.5 sm:p-5 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1">
                          🏁 COMPLETED
                        </span>
                        <span className={`px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold border uppercase tracking-wider flex items-center gap-1 ${
                          isSolo
                            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25'
                            : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                        }`}>
                          {isSolo ? <User className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                          <span>{isSolo ? 'Individual' : 'Team Battle'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          {c.completedAt ? formatDisplayYmd(c.completedAt) : formatDisplayYmd(c.endDate)}
                        </span>
                        {canManageYptChallenges && (
                          <>
                            <button
                              onClick={(e) => handleReopenChallenge(e, c)}
                              className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                              title="Re-open Challenge back to Active"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleCardDelete(e, c)}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Move to Recycle Bin"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {c.title}
                    </h3>
                    {c.description && (
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {c.description}
                      </p>
                    )}

                    {/* Winner Summary Badges */}
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                      {isSolo && soloWinnerHandle && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] font-extrabold">
                          <div className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-black text-[10px] flex items-center justify-center shadow-xs shrink-0">
                            {soloWinnerHandle.replace(/^@/, '').slice(0, 1).toUpperCase()}
                          </div>
                          <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-mono">Champion: {soloWinnerHandle}</span>
                        </div>
                      )}
                      {isSolo && mvpHandle && mvpHandle !== soloWinnerHandle && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold font-mono">
                          <Crown className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>MVP: {mvpHandle}</span>
                        </div>
                      )}
                      {!isSolo && winningTeam && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-extrabold">
                          <Trophy className="w-3.5 h-3.5 text-amber-500" />
                          <span>Winner: {winningTeam.name} ({winningTeam.totalPoints} XP)</span>
                        </div>
                      )}
                      {!isSolo && mvpHandle && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold font-mono">
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                          <span>MVP: {mvpHandle}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] sm:text-xs">
                    <div className="flex items-center gap-2.5 sm:gap-3 text-slate-600 dark:text-slate-400 font-medium">
                      {isSolo ? (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-purple-500 shrink-0" /> {c.participants?.length || 0} Participants
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> {teamsList.length} Teams
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Final Results Locked
                      </span>
                    </div>

                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                      View Final Standings <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Team Rankings Tab */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Overall Challenge Standings
          </h3>

          <div className="space-y-3">
            {allVisibleChallenges.flatMap((c) => c.teams || []).length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">No team records found.</div>
            ) : (
              allVisibleChallenges
                .flatMap((c) => (c.teams || []).map((t) => ({ ...t, challengeTitle: c.title })))
                .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
                .map((team, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{team.name}</p>
                        <p className="text-[10px] text-slate-500">{team.challengeTitle}</p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                      {team.totalPoints} XP
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
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

      <YptUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        challenges={activeChallenges}
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

      <YptAutoSyncModal
        isOpen={isAutoSyncModalOpen}
        onClose={() => setIsAutoSyncModalOpen(false)}
        onIntervalChanged={(mins) => setSyncIntervalMinutes(mins)}
      />
    </div>
  );
}

