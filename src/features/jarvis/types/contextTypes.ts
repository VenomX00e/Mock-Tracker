export interface VisionNavigationContext {
  currentTab: string;
  activeSubject: string | null;
  activeMockId: string | null;
}

export interface VisionActiveQuestion {
  id: string;
  subject: string;
  topic: string;
  userAnswer?: string;
  correctAnswer?: string;
  status: 'correct' | 'incorrect' | 'unattempted' | string;
}

export interface VisionVisibleSummary {
  score?: string;
  accuracy?: string;
  timeTaken?: string;
  percentile?: string;
  [key: string]: string | undefined;
}

export interface VisionScreenData {
  title: string;
  visibleSummary: VisionVisibleSummary;
  activeQuestion: VisionActiveQuestion | null;
  visibleItems: string[];
}

export interface VisionUserState {
  targetExam: string;
  totalMocksAttempted: number;
  weakSubjects: string[];
  strongSubjects: string[];
}

export interface VisionContextPayload {
  navigation: VisionNavigationContext;
  screenData: VisionScreenData;
  userState: VisionUserState;
}

export interface ScreenLocation {
  activeTab: string;          // e.g. 'home', 'dashboard', 'learning', 'tasks', 'community', 'profile', 'add-mock', 'countdowns'
  navigatedFrom?: string;     // Previous active tab if auto-navigation took place
  learningSubTab?: string;    // e.g. 'ai', 'vocab', 'math', 'practice'
  communitySubTab?: string;   // e.g. 'leaderboard', 'log', 'chat'
  activeSection?: string;     // e.g. '#countdowns', '#live-mocks', '#performance-trend', '#history-log'
  activeModal?: string | null;// e.g. 'changelog', 'add-mock-modal', 'profile-modal', 'admin-modal', 'tasks-modal', null
}

export interface ScreenDataSnapshot {
  targetExam?: string;        // e.g. 'CAT 2026'
  examCategory?: string;      // e.g. 'Management / MBA'
  userName?: string;

  // Module 1: Dashboard (Home)
  dashboardData?: {
    liveMocksCount: number;
    upcomingCountdownsCount: number;
    recentMockAverageScore?: number;
    historyLogCount?: number;
    availableSections: string[];
  };

  // Module 2: Learning Hub
  learningData?: {
    currentSubTab?: string;
    currentVocabWord?: string;
    speedMathLevel?: number;
    activePracticeSubject?: string;
  };

  // Module 3: Tasks & Planning
  tasksData?: {
    totalTasksCount: number;
    pendingTasksCount: number;
    completedTasksCount: number;
    topPendingTaskTitle?: string;
  };

  // Module 4: Add Mock
  addMockData?: {
    isOpen: boolean;
    activeExamCategory?: string;
  };

  // Module 5: Community Hub
  communityData?: {
    userRank?: number;
    userXp?: number;
    activeSubTab?: string;
  };

  // Module 6: Profile
  profileData?: {
    userName?: string;
    targetExam?: string;
    studyStreak?: number;
    theme?: string;
  };

  // Module 7: Change Log
  changeLogData?: {
    isOpen: boolean;
    currentVersion?: string;
  };

  // Module 8: App Theme
  themeData?: {
    activeTheme: string;
    isDarkMode: boolean;
  };
}

export interface JarvisPageContext {
  location: ScreenLocation;
  data: ScreenDataSnapshot;
  visionContext: VisionContextPayload;
  timestamp: string;
}

