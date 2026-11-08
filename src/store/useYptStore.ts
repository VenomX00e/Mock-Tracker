import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeToYptChallenges } from '../services/yptService';
import { YptChallenge } from '../types/yptTypes';

interface YptState {
  challenges: YptChallenge[];
  activeChallengeId: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  isFromCache: boolean;

  // Subscription controller
  unsubscribeChallenges: (() => void) | null;

  // Actions
  initChallengesListener: () => void;
  selectChallenge: (challengeId: string | null) => void;
  cleanupListeners: () => void;
  forceRefresh: () => Promise<void>;

  // Optimistic UI updates
  optimisticAddChallenge: (challenge: YptChallenge) => void;
  optimisticUpdateChallenge: (challengeId: string, updates: Partial<YptChallenge>) => void;
  optimisticRemoveChallenge: (challengeId: string) => void;
}

export const useYptStore = create<YptState>()(
  persist(
    (set, get) => ({
      challenges: [],
      activeChallengeId: null,
      isLoading: false,
      isSyncing: false,
      lastSyncedAt: null,
      isFromCache: false,

      unsubscribeChallenges: null,

      initChallengesListener: () => {
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
        set({
          activeChallengeId: challengeId,
        });
      },

      cleanupListeners: () => {
        const { unsubscribeChallenges } = get();
        if (unsubscribeChallenges) unsubscribeChallenges();

        set({
          unsubscribeChallenges: null,
        });
      },

      forceRefresh: async () => {
        set({ isSyncing: true });
        const { cleanupListeners, initChallengesListener } = get();

        cleanupListeners();
        initChallengesListener();

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
    }),
    {
      name: 'ypt-storage-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        challenges: state.challenges,
        activeChallengeId: state.activeChallengeId,
      }),
    }
  )
);
