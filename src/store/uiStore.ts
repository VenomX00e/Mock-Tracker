import { create } from 'zustand';

type AdminTab = 'categories' | 'subjects' | 'admins' | 'countdowns' | 'notices' | 'live-mocks' | 'challenges' | 'general' | 'users' | 'requests';

interface UIState {
  activeTab: 'dashboard' | 'community' | 'admin' | 'tasks' | 'add-mock' | 'admin-panel' | 'profile';
  setActiveTab: (tab: 'dashboard' | 'community' | 'admin' | 'tasks' | 'add-mock' | 'admin-panel' | 'profile') => void;
  
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  
  activePublicProfile: any;
  setActivePublicProfile: (profile: any) => void;
  
  isAdminModalOpen: boolean;
  setIsAdminModalOpen: (open: boolean) => void;
  
  isRequestsModalOpen: boolean;
  setIsRequestsModalOpen: (open: boolean) => void;
  
  isChallengeRecycleBinOpen: boolean;
  setIsChallengeRecycleBinOpen: (open: boolean) => void;
  
  isHiddenChallengesModalOpen: boolean;
  setIsHiddenChallengesModalOpen: (open: boolean) => void;
  
  isApiModalOpen: boolean;
  setIsApiModalOpen: (open: boolean) => void;
  
  isAddLiveMockOpen: boolean;
  setIsAddLiveMockOpen: (open: boolean) => void;
  
  isCreateChallengeOpen: boolean;
  setIsCreateChallengeOpen: (open: boolean) => void;
  
  showTasksModal: boolean;
  setShowTasksModal: (open: boolean) => void;
  
  adminTab: AdminTab;
  setAdminTab: (tab: AdminTab) => void;
  
  adminEditNotice: any;
  setAdminEditNotice: (notice: any) => void;
  
  adminEditCountdown: any;
  setAdminEditCountdown: (countdown: any) => void;
  
  darkMode: boolean;
  setDarkMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
  theme: 'light' | 'dark' | 'cyber';
  setTheme: (theme: 'light' | 'dark' | 'cyber') => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  isAddModalOpen: false,
  setIsAddModalOpen: (open) => set({ isAddModalOpen: open }),
  
  isProfileModalOpen: false,
  setIsProfileModalOpen: (open) => set({ isProfileModalOpen: open }),
  
  activePublicProfile: null,
  setActivePublicProfile: (profile) => set({ activePublicProfile: profile }),
  
  isAdminModalOpen: false,
  setIsAdminModalOpen: (open) => set({ isAdminModalOpen: open }),
  
  isRequestsModalOpen: false,
  setIsRequestsModalOpen: (open) => set({ isRequestsModalOpen: open }),
  
  isChallengeRecycleBinOpen: false,
  setIsChallengeRecycleBinOpen: (open) => set({ isChallengeRecycleBinOpen: open }),
  
  isHiddenChallengesModalOpen: false,
  setIsHiddenChallengesModalOpen: (open) => set({ isHiddenChallengesModalOpen: open }),
  
  isApiModalOpen: false,
  setIsApiModalOpen: (open) => set({ isApiModalOpen: open }),
  
  isAddLiveMockOpen: false,
  setIsAddLiveMockOpen: (open) => set({ isAddLiveMockOpen: open }),
  
  isCreateChallengeOpen: false,
  setIsCreateChallengeOpen: (open) => set({ isCreateChallengeOpen: open }),
  
  showTasksModal: false,
  setShowTasksModal: (open) => set({ showTasksModal: open }),
  
  adminTab: 'categories',
  setAdminTab: (tab) => set({ adminTab: tab as any }),
  
  adminEditNotice: null,
  setAdminEditNotice: (notice) => set({ adminEditNotice: notice }),
  
  adminEditCountdown: null,
  setAdminEditCountdown: (countdown) => set({ adminEditCountdown: countdown }),
  
  darkMode: localStorage.getItem('darkMode') === 'true',
  theme: (localStorage.getItem('theme') as 'light' | 'dark' | 'cyber') || (localStorage.getItem('darkMode') === 'true' ? 'dark' : 'light'),
  setDarkMode: (mode) => set((state) => {
    const newMode = typeof mode === 'function' ? mode(state.darkMode) : mode;
    if (newMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('cyber', 'light');
      localStorage.setItem('darkMode', 'true');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark', 'cyber');
      document.documentElement.classList.add('light');
      localStorage.setItem('darkMode', 'false');
      localStorage.setItem('theme', 'light');
    }
    return { darkMode: newMode, theme: newMode ? 'dark' : 'light' };
  }),
  setTheme: (theme) => set((state) => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.remove('light', 'dark', 'cyber');
    document.documentElement.classList.add(theme);
    if (theme === 'dark' || theme === 'cyber') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      localStorage.setItem('darkMode', 'false');
    }
    return { theme, darkMode: theme === 'dark' || theme === 'cyber' };
  }),
}));
