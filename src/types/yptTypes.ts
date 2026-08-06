export type YptRuleConditionType = 'emoji_only' | 'hours_only' | 'both' | 'either';

export interface YptCustomRule {
  id: string;
  name: string; // e.g. "Morning Snap Bonus", "Target 5 Hours Bonus"
  emoji?: string; // e.g. "☀️", "🌻", "📱"
  points: number; // e.g. 5
  type: 'bonus' | 'penalty';
  conditionType?: YptRuleConditionType; // Default 'emoji_only'
  minHoursNeeded?: number; // Minimum hours required for 'hours_only', 'both', or 'either'
}

export interface YptRuleConfig {
  pointsPerStudyHour: number; // e.g. 1 hour = +2 pts (legacy / derived)
  studyIntervalValue?: number; // e.g. 30, 1
  studyIntervalUnit?: 'minutes' | 'hours'; // e.g. 'minutes', 'hours'
  pointsPerInterval?: number; // e.g. 1 point for every 30 mins
  penaltyThresholdValue?: number; // e.g. 3, 30
  penaltyThresholdUnit?: 'minutes' | 'hours'; // e.g. 'hours', 'minutes'
  noStudyPenaltyThresholdHours?: number; // e.g. no study for 3 hours (legacy)
  penaltyPoints: number; // e.g. -5 pts
  morningSnapBonus?: number; // e.g. morning snap = +5 pts (optional legacy)
  customRules?: YptCustomRule[];
}

export interface YptTeam {
  id: string;
  name: string;
  color?: string;
  memberUids: string[];
  teamLeaders?: string[]; // Array of YPT handles assigned as leaders
  totalPoints: number;
}

export interface YptMemberScore {
  uid: string;
  yptHandles: string[];
  totalPoints: number;
  hoursStudied: number;
  submissionsCount: number;
  lastUpdated?: string | number;
}

export interface YptExtractedMemberData {
  yptHandle: string;
  matchedUid?: string;
  hoursStudied: number;
  morningSnap: boolean;
  pointsEarned: number;
  detectedEmojis?: string[];
  detectedRules?: Array<{
    ruleId?: string;
    ruleName: string;
    emoji: string;
    points: number;
  }>;
}

export interface YptSubmissionLog {
  id: string;
  challengeId: string;
  uploaderUid: string;
  imageUrl: string;
  extractedMembers: YptExtractedMemberData[];
  totalPointsAwarded: number;
  timestamp: string | number;
  dateYmd?: string;
  targetDateYmd?: string;
  status: 'pending' | 'verified' | 'rejected';
  notes?: string;
  detectedRules?: Array<{
    ruleId: string;
    ruleName: string;
    emoji: string;
    points: number;
  }>;
}

export interface YptChallenge {
  id: string;
  title: string;
  description?: string;
  leaderUid: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'draft' | 'deleted';
  rules: YptRuleConfig;
  teams: YptTeam[];
  createdAt: string | number;
  updatedAt?: string | number;
  isDeleted?: boolean;
  deletedAt?: string | number;
}
