export interface SectionalScore {
  score: number;
  percentile: number;
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
  date: string;
  score: number;
  percentile: number;
  percentage: number;
  quant: SectionalScore;
  reasoning: SectionalScore;
  english: SectionalScore;
}
