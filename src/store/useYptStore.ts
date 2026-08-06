import { create } from 'zustand';
import { subscribeToYptChallenges, subscribeToSubmissionLogs } from '../services/yptService';
import { YptChallenge, YptSubmissionLog } from '../types/yptTypes';

interface YptState {
  challenges: YptChallenge[];
  activeChallengeId: string | null;
  activeSubmissionLogs: YptSubmissionLog[];
  isLoading: boolean;
  
  // Subscription controllers
  unsubscribeChallenges: (() => void) | null;
  unsubscribeLogs: (() => void) | null;

  // Actions
  initChallengesListener: () => void;
  selectChallenge: (challengeId: string | null) => void;
  cleanupListeners: () => void;

  // Optimistic UI updates
  optimisticUpdateMemberLog: (memberHandle: string, dateYmd: string, hours: number) => void;
}

export const useYptStore = create<YptState>((set, get) => ({
  challenges: [],
  activeChallengeId: null,
  activeSubmissionLogs: [],
  isLoading: false,

  unsubscribeChallenges: null,
  unsubscribeLogs: null,

  initChallengesListener: () => {
    // Prevent duplicate subscriptions if already subscribed
    if (get().unsubscribeChallenges) return;

    set({ isLoading: true });

    const unsub = subscribeToYptChallenges((challenges) => {
      set({ challenges, isLoading: false });
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

    // Subscribe to new challenge's submission logs
    const unsub = subscribeToSubmissionLogs(challengeId, (logs) => {
      set({ activeSubmissionLogs: logs });
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
}));

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

