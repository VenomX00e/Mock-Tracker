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
  totalTests: number;
  streak: number;
  streakActive?: boolean;
  updatedAt?: any;
  lastActiveAt?: any;
  isBanned?: boolean;
  isMuted?: boolean;
  lastMockDate?: string;
  role?: string;
  tasks?: ReflectionTask[];
}

export interface ReflectionTask {
  id: string;
  text: string;
  completed: boolean;
  completedParts?: number;
  totalParts?: number;
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
}
