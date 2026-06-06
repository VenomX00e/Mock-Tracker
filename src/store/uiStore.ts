import { create } from "zustand";

type AdminTab =
  | "categories"
  | "subjects"
  | "admins"
  | "countdowns"
  | "notices"
  | "live-mocks"
  | "challenges"
  | "general"
  | "users"
  | "requests"
  | "quotes";

interface UIState {
  activeTab:
    | "home"
    | "dashboard"
    | "community"
    | "admin"
    | "tasks"
    | "add-mock"
    | "admin-panel"
    | "profile"
    | "learning"
    | "countdowns";
  setActiveTab: (
    tab:
      | "home"
      | "dashboard"
      | "community"
      | "admin"
      | "tasks"
      | "add-mock"
      | "admin-panel"
      | "profile"
      | "learning"
      | "countdowns",
  ) => void;

  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;

  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;

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

  darkMode: boolean;
  setDarkMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
  theme:
    | "light"
    | "dark"
    | "cyber"
    | "cyber-light"
    | "cyber-green"
    | "cyber-green-light"
    | "cyber-lavender"
    | "cyber-lavender-light"
    | "cyber-pink"
    | "cyber-pink-light"
    | "cyber-orange"
    | "cyber-orange-light"
    | "hero-miles";
  setTheme: (
    theme:
      | "light"
      | "dark"
      | "cyber"
      | "cyber-light"
      | "cyber-green"
      | "cyber-green-light"
      | "cyber-lavender"
      | "cyber-lavender-light"
      | "cyber-pink"
      | "cyber-pink-light"
      | "cyber-orange"
      | "cyber-orange-light"
      | "hero-miles",
  ) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;

  mockToEdit: any | undefined;
  setMockToEdit: (mock: any) => void;
  editingChallenge: any | null;
  setEditingChallenge: (challenge: any | null) => void;
  activePublicProfile: any | null;
  setActivePublicProfile: (profile: any | null) => void;
  adminEditNotice: any | null;
  setAdminEditNotice: (notice: any | null) => void;
  adminEditCountdown: any | null;
  setAdminEditCountdown: (countdown: any | null) => void;
}

const ALL_THEME_CLASSES = [
  "light",
  "dark",
  "cyber",
  "cyber-light",
  "cyber-green",
  "cyber-green-light",
  "cyber-lavender",
  "cyber-lavender-light",
  "cyber-pink",
  "cyber-pink-light",
  "cyber-orange",
  "cyber-orange-light",
  "hero-miles",
];

export const useUIStore = create<UIState>((set) => ({
  isSidebarCollapsed: true,
  setIsSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),

  mockToEdit: undefined,
  setMockToEdit: (mock) => set({ mockToEdit: mock }),
  editingChallenge: null,
  setEditingChallenge: (challenge) => set({ editingChallenge: challenge }),
  activePublicProfile: null,
  setActivePublicProfile: (profile) => set({ activePublicProfile: profile }),
  adminEditNotice: null,
  setAdminEditNotice: (notice) => set({ adminEditNotice: notice }),
  adminEditCountdown: null,
  setAdminEditCountdown: (countdown) => set({ adminEditCountdown: countdown }),


  activeTab: "home",
  setActiveTab: (tab) => set({ activeTab: tab }),

  isAddModalOpen: false,
  setIsAddModalOpen: (open) => set({ isAddModalOpen: open }),

  isProfileModalOpen: false,
  setIsProfileModalOpen: (open) => set({ isProfileModalOpen: open }),

  isAdminModalOpen: false,
  setIsAdminModalOpen: (open) => set({ isAdminModalOpen: open }),

  isRequestsModalOpen: false,
  setIsRequestsModalOpen: (open) => set({ isRequestsModalOpen: open }),

  isChallengeRecycleBinOpen: false,
  setIsChallengeRecycleBinOpen: (open) =>
    set({ isChallengeRecycleBinOpen: open }),

  isHiddenChallengesModalOpen: false,
  setIsHiddenChallengesModalOpen: (open) =>
    set({ isHiddenChallengesModalOpen: open }),

  isApiModalOpen: false,
  setIsApiModalOpen: (open) => set({ isApiModalOpen: open }),

  isAddLiveMockOpen: false,
  setIsAddLiveMockOpen: (open) => set({ isAddLiveMockOpen: open }),

  isCreateChallengeOpen: false,
  setIsCreateChallengeOpen: (open) => set({ isCreateChallengeOpen: open }),

  showTasksModal: false,
  setShowTasksModal: (open) => set({ showTasksModal: open }),

  adminTab: "categories",
  setAdminTab: (tab) => set({ adminTab: tab as any }),

  darkMode: localStorage.getItem("darkMode") === "true",
  theme:
    (localStorage.getItem("theme") as
      | "light"
      | "dark"
      | "cyber"
      | "cyber-light"
      | "cyber-green"
      | "cyber-lavender"
      | "cyber-pink"
      | "cyber-orange"
      | "hero-miles") ||
    (localStorage.getItem("darkMode") === "true" ? "dark" : "light"),
  setDarkMode: (mode) =>
    set((state) => {
      const newMode = typeof mode === "function" ? mode(state.darkMode) : mode;
      if (newMode) {
        document.documentElement.classList.remove(...ALL_THEME_CLASSES);
        document.documentElement.classList.add("dark");
        localStorage.setItem("darkMode", "true");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove(...ALL_THEME_CLASSES);
        document.documentElement.classList.add("light");
        localStorage.setItem("darkMode", "false");
        localStorage.setItem("theme", "light");
      }
      return { darkMode: newMode, theme: newMode ? "dark" : "light" };
    }),
  setTheme: (theme) =>
    set((state) => {
      localStorage.setItem("theme", theme);
      document.documentElement.classList.remove(...ALL_THEME_CLASSES);
      document.documentElement.classList.add(theme);
      
      const isDarkTheme = (theme.startsWith("cyber") && !theme.includes("-light")) || theme === "dark" || theme === "hero-miles";
      
      if (isDarkTheme) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("darkMode", "true");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("darkMode", "false");
      }
      return {
        theme,
        darkMode: isDarkTheme,
      };
    }),
}));
