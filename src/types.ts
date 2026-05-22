export interface SectionalScore {
  score?: number | null;
  percentile?: number | null;
  accuracy?: number | null;
}

export interface UserProfile {
  userId: string;
  email?: string;
  displayName: string;
  photoURL: string;
  targetedExam: string;
  avgPercentile: number;
  avgAccuracy?: number;
  avgQuantPercentile: number;
  avgReasoningPercentile: number;
  avgEnglishPercentile: number;
  avgGaPercentile?: number;
  dynamicAverages?: Record<string, number>;
  totalTests: number;
  categoryStats?: Record<string, any>;
  streak: number;
  streakActive?: boolean;
  updatedAt?: any;
  lastActiveAt?: any;
  isBanned?: boolean;
  isMuted?: boolean;
  mutedAt?: number;
  lastMockDate?: string;
  role?: string;
  adminCategories?: string[];
  categoryId?: string; // Add categoryId
  bio?: string;
  badges?: any[];
  permissions?: {
    canManageUsers?: boolean;
    canManageNotices?: boolean;
    canManageChallenges?: boolean;
    canManageLiveMocks?: boolean;
    canManageCountdowns?: boolean;
    canManageSettings?: boolean;
    canManageQuotes?: boolean;
  };
  tasks?: ReflectionTask[];
}

export interface ReflectionTask {
  id: string;
  text: string;
  completed: boolean;
  completedParts?: number;
  totalParts?: number;
  createdAt?: string;
  completedAt?: string;
}

export interface MockScore {
  id: string;
  userId?: string;
  createdAt?: any;
  examType: string;
  examRole?: string;
  examPhase?: string;
  examScope?: string;
  mockName: string;
  platform?: string;
  customPlatform?: string;
  date: string;
  score?: number | null;
  percentile?: number | null;
  percentage?: number | null;
  accuracy?: number | null;
  streakAtTime?: number | null;
  quant?: SectionalScore;
  reasoning?: SectionalScore;
  english?: SectionalScore;
  ga?: SectionalScore;
  computer?: SectionalScore;
  note?: string;
  tags?: string[];
  difficulty?: string;
  nervousness?: string;
  focus?: string;
  energy?: string;
  timeState?: string;
  tasks?: ReflectionTask[];
  categoryId?: string;
  dynamicSubjects?: Record<string, SectionalScore>;
}

export interface ExamCategory {
  id: string;
  name: string;
  subjectPrefix?: string;
  exams?: string[];
  roles?: string[];
  phases?: string[];
  scopes?: string[];
  platforms?: string[];
  subjects?: { id: string; name: string; short?: string, phases?: string[] }[];
}
