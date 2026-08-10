import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeToYptChallenges, subscribeToYptSubmissions } from '../services/yptService';
import { YptChallenge, YptSubmissionLog } from '../types/yptTypes';

interface YptState {
  challenges: YptChallenge[];
  activeChallengeId: string | null;
  activeSubmissionLogs: YptSubmissionLog[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  isFromCache: boolean;
  
  // Subscription controllers
  unsubscribeChallenges: (() => void) | null;
  unsubscribeLogs: (() => void) | null;

  // Actions
  initChallengesListener: () => void;
  selectChallenge: (challengeId: string | null) => void;
  cleanupListeners: () => void;
  forceRefresh: () => Promise<void>;

  // Optimistic UI updates
  optimisticAddChallenge: (challenge: YptChallenge) => void;
  optimisticUpdateChallenge: (challengeId: string, updates: Partial<YptChallenge>) => void;
  optimisticRemoveChallenge: (challengeId: string) => void;
  optimisticAddSubmissionLog: (submission: YptSubmissionLog) => void;
  optimisticUpdateSubmissionStatus: (submissionId: string, status: 'verified' | 'rejected') => void;
  optimisticUpdateMemberLog: (memberHandle: string, dateYmd: string, hours: number) => void;
}

export const useYptStore = create<YptState>()(
  persist(
    (set, get) => ({
      challenges: [],
      activeChallengeId: null,
      activeSubmissionLogs: [],
      isLoading: false,
      isSyncing: false,
      lastSyncedAt: null,
      isFromCache: false,

      unsubscribeChallenges: null,
      unsubscribeLogs: null,

      initChallengesListener: () => {
        // Prevent duplicate subscriptions if already subscribed
        if (get().unsubscribeChallenges) return;

        set({ isLoading: true });

        const unsub = subscribeToYptChallenges((incomingChallenges, docChanges, metadata) => {
          const current = get().challenges || [];

          let nextChallenges = incomingChallenges;
          if (docChanges && docChanges.length > 0 && current.length > 0) {
            let updatedList = [...current];

            for (const change of docChanges) {
              if (change.type === 'removed') {
                updatedList = updatedList.filter((c) => c.id !== change.item.id);
              } else if (change.type === 'added' || change.type === 'modified') {
                const idx = updatedList.findIndex((c) => c.id === change.item.id);
                if (idx >= 0) {
                  updatedList[idx] = change.item;
                } else {
                  updatedList.push(change.item);
                }
              }
            }

            // Keep sorted by createdAt desc
            updatedList.sort((a, b) => {
              const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return timeB - timeA;
            });

            nextChallenges = updatedList;
          }

          set({
            challenges: nextChallenges,
            isLoading: false,
            isSyncing: Boolean(metadata?.hasPendingWrites),
            isFromCache: Boolean(metadata?.fromCache),
            lastSyncedAt: new Date().toISOString(),
          });
        });

        set({ unsubscribeChallenges: unsub });
      },

      selectChallenge: (challengeId: string | null) => {
        const { unsubscribeLogs, activeChallengeId } = get();

        if (activeChallengeId === challengeId && unsubscribeLogs) return;

        // Clean up previous submission logs subscription if changing challenge
        if (unsubscribeLogs) {
          unsubscribeLogs();
        }

        if (!challengeId) {
          set({
            activeChallengeId: null,
            activeSubmissionLogs: [],
            unsubscribeLogs: null,
          });
          return;
        }

        // Subscribe to new challenge's submission logs with real-time delta handling
        const unsub = subscribeToYptSubmissions(challengeId, (incomingLogs, docChanges, metadata) => {
          const current = get().activeSubmissionLogs || [];

          let nextLogs = incomingLogs;
          if (docChanges && docChanges.length > 0 && current.length > 0) {
            let updatedLogs = [...current];

            for (const change of docChanges) {
              if (change.type === 'removed') {
                updatedLogs = updatedLogs.filter((l) => l.id !== change.item.id);
              } else if (change.type === 'added' || change.type === 'modified') {
                const idx = updatedLogs.findIndex((l) => l.id === change.item.id);
                if (idx >= 0) {
                  updatedLogs[idx] = change.item;
                } else {
                  updatedLogs.push(change.item);
                }
              }
            }

            updatedLogs.sort((a, b) => {
              const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
              const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
              return timeB - timeA;
            });

            nextLogs = updatedLogs;
          }

          set({
            activeSubmissionLogs: nextLogs,
            isSyncing: Boolean(metadata?.hasPendingWrites),
            isFromCache: Boolean(metadata?.fromCache),
            lastSyncedAt: new Date().toISOString(),
          });
        });

        set({
          activeChallengeId: challengeId,
          unsubscribeLogs: unsub,
        });
      },

      cleanupListeners: () => {
        const { unsubscribeChallenges, unsubscribeLogs } = get();
        if (unsubscribeChallenges) unsubscribeChallenges();
        if (unsubscribeLogs) unsubscribeLogs();

        set({
          unsubscribeChallenges: null,
          unsubscribeLogs: null,
        });
      },

      forceRefresh: async () => {
        set({ isSyncing: true });
        const { cleanupListeners, initChallengesListener, selectChallenge, activeChallengeId } = get();
        
        // Restart listeners
        cleanupListeners();
        initChallengesListener();
        if (activeChallengeId) {
          selectChallenge(activeChallengeId);
        }

        set({
          isSyncing: false,
          isFromCache: false,
          lastSyncedAt: new Date().toISOString(),
        });
      },

      optimisticAddChallenge: (newChallenge: YptChallenge) => {
        const { challenges } = get();
        const existingIdx = challenges.findIndex((c) => c.id === newChallenge.id);
        if (existingIdx >= 0) {
          const updated = [...challenges];
          updated[existingIdx] = newChallenge;
          set({ challenges: updated });
        } else {
          const updated = [newChallenge, ...challenges];
          set({ challenges: updated });
        }
      },

      optimisticUpdateChallenge: (challengeId: string, updates: Partial<YptChallenge>) => {
        const { challenges } = get();
        const updated = challenges.map((c) => {
          if (c.id === challengeId) {
            return { ...c, ...updates };
          }
          return c;
        });
        set({ challenges: updated });
      },

      optimisticRemoveChallenge: (challengeId: string) => {
        const { challenges } = get();
        set({ challenges: challenges.filter((c) => c.id !== challengeId) });
      },

      optimisticAddSubmissionLog: (newSubmission: YptSubmissionLog) => {
        const { activeSubmissionLogs, activeChallengeId } = get();
        if (activeChallengeId && newSubmission.challengeId !== activeChallengeId) return;

        const existingIdx = activeSubmissionLogs.findIndex((l) => l.id === newSubmission.id);
        if (existingIdx >= 0) {
          const updated = [...activeSubmissionLogs];
          updated[existingIdx] = newSubmission;
          set({ activeSubmissionLogs: updated });
        } else {
          const updated = [newSubmission, ...activeSubmissionLogs];
          set({ activeSubmissionLogs: updated });
        }
      },

      optimisticUpdateSubmissionStatus: (submissionId: string, status: 'verified' | 'rejected') => {
        const { activeSubmissionLogs } = get();
        const updated = activeSubmissionLogs.map((l) =>
          l.id === submissionId ? { ...l, status } : l
        );
        set({ activeSubmissionLogs: updated });
      },

      optimisticUpdateMemberLog: (memberHandle: string, dateYmd: string, hours: number) => {
        const { activeSubmissionLogs } = get();
        const cleanHandle = memberHandle.replace(/^@/, '').trim().toLowerCase();

        // Check if there's an existing log with matching member and target date
        const updatedLogs = activeSubmissionLogs.map((log) => {
          const matchMember = log.extractedMembers?.find(
            (m) => m.yptHandle.replace(/^@/, '').trim().toLowerCase() === cleanHandle
          );

          if (matchMember && (log.targetDateYmd === dateYmd || log.dateYmd === dateYmd)) {
            return {
              ...log,
              extractedMembers: log.extractedMembers.map((m) =>
                m.yptHandle.replace(/^@/, '').trim().toLowerCase() === cleanHandle
                  ? { ...m, hoursStudied: hours }
                  : m
              ),
            };
          }
          return log;
        });

        set({ activeSubmissionLogs: updatedLogs });
      },
    }),
    {
      name: 'ypt-storage-v1', // key in localStorage
      storage: createJSONStorage(() => localStorage),
      // Persist challenges, active challenge ID, and submission logs; exclude functions and transient flags
      partialize: (state) => ({
        challenges: state.challenges,
        activeChallengeId: state.activeChallengeId,
        activeSubmissionLogs: state.activeSubmissionLogs,
      }),
    }
  )
);

// Zustand Selector for derived leaderboard calculations
export const useYptLeaderboard = (challengeId: string) => {
  return useYptStore((state) => {
    const challenge = state.challenges.find((c) => c.id === challengeId);
    if (!challenge || !challenge.teams) return [];

    const logs = state.activeSubmissionLogs;

    // Filter valid submission logs (verified or pending)
    const validLogs = logs.filter((log) => log.status !== 'rejected');

    // Group logs by handle & calculate totals entirely in memory
    const memberTotals = validLogs.reduce((acc, log) => {
      (log.extractedMembers || []).forEach((m) => {
        if (!m.yptHandle) return;
        const handle = m.yptHandle.replace(/^@/, '').trim().toLowerCase();
        acc[handle] = (acc[handle] || 0) + (m.pointsEarned || 0);
      });
      return acc;
    }, {} as Record<string, number>);

    // Map back to teams and compute totalPoints
    return challenge.teams
      .map((team) => {
        const teamMembers = (team as any).members || team.memberUids || [];
        const teamPoints = teamMembers.reduce((sum: number, member: any) => {
          const rawHandle = typeof member === 'string' ? member : (member.handle || member.yptHandle || '');
          const cleanHandle = rawHandle.replace(/^@/, '').trim().toLowerCase();
          return sum + (memberTotals[cleanHandle] || 0);
        }, 0);

        return { ...team, totalPoints: teamPoints };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);
  });
};

