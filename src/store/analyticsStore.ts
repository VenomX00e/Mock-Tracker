import { create } from 'zustand';
import { parseLocalDate } from '../lib/utils';
import { getSub } from '../lib/subjectUtils';
import { collection, query, orderBy, limit, getDocs, collectionGroup, where } from 'firebase/firestore';
import { db } from '../services/firebase';

interface CacheStore {
  // Dashboard Cache
  isDashboardCached: boolean;
  dashboardStats: any;
  chartDataReversed: any;
  flattenedData: any;
  displayedMocks: any[];
  activeTrendFilteredChronologicalMocks: any[];
  overallTrendAveragesData: any;
  averageTrendLineValue: any;
  activeTrendFilteredMocks: any[];
  chronologicalMocks: any[];

  selectedExam: string;
  selectedRole: string;
  selectedPhase: string;
  selectedScope: string;
  selectedTrendPeriod: string;
  activeTrendId: string;
  statsCountRange: number | 'all';
  setStatsCountRange: (val: number | 'all') => void;
  dashboardHash: string | null;
  
  updateDashboardCache: (payload: Partial<CacheStore>) => void;
  computeDashboardStats: (mocks: any[], subjects: any[], options: any) => void;


  // Community Cache
  isCommunityCached: boolean;
  allUsers: any[];
  userMap: Record<string, any>;
  feedLogs: any[];
  allFeedMocks: any[];
  deletedMocks: any[];
  communitySelectedPhase: string;
  communitySelectedPeriod: string;
  communitySortConfig: { key: string | null, direction: 'asc'|'desc'|null };
  communityHash: string | null;
  sortedLeaderboard: any[];
  activeAllUsers: any[];
  communityFilteredFeedLogs: any[];
  chatMessages: any[];
  
  // Update Community
  updateCommunityCache: (payload: Partial<CacheStore>) => void;
  
  // Data fetcher for community
  fetchCommunityData: (categoryId: string, isAdmin: boolean) => Promise<void>;
}

export const useCacheStore = create<CacheStore>((set, get) => ({
  isDashboardCached: false,
  dashboardStats: null,
  chartDataReversed: null,
  flattenedData: null,
  displayedMocks: [],
  activeTrendFilteredChronologicalMocks: [],
  overallTrendAveragesData: null,
  averageTrendLineValue: null,
  activeTrendFilteredMocks: [],
  chronologicalMocks: [],

  selectedExam: 'All',
  selectedRole: 'All',
  selectedPhase: 'All',
  selectedScope: 'All',
  selectedTrendPeriod: '15 Days',
  activeTrendId: 'overall',
  statsCountRange: 'all',
  setStatsCountRange: (val) => set({ statsCountRange: val }),
  dashboardHash: null,

  updateDashboardCache: (payload) => set((state) => ({ ...state, ...payload, isDashboardCached: true })),
  computeDashboardStats: (mocks, subjects, options) => {
    // We do not compute inside the store directly for code size limits, we can keep the computation in Dashboard.tsx but wrapped in a useEffect that writes to the store!
  },

  isCommunityCached: false,
  allUsers: [],
  userMap: {},
  feedLogs: [],
  allFeedMocks: [],
  deletedMocks: [],
  communitySelectedPhase: 'All',
  communitySelectedPeriod: '7 Days',
  communitySortConfig: { key: 'avgPercentile', direction: 'desc' },
  communityHash: null,
  sortedLeaderboard: [],
  activeAllUsers: [],
  communityFilteredFeedLogs: [],
  chatMessages: [],

  updateCommunityCache: (payload) => set((state) => ({ ...state, ...payload, isCommunityCached: true })),

  fetchCommunityData: async (categoryId, isAdmin) => {
      // Logic from useCommunityPosts will be moved here or just cached
  }
}));

