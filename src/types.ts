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
  isBanned?: boolean;
  isMuted?: boolean;
  lastMockDate?: string;
  role?: string;
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
}
