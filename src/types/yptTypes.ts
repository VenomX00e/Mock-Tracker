export type YptRuleConditionType = 'emoji_only' | 'hours_only' | 'both' | 'either';

// Raw YPT API Payload Interfaces
export interface YptApiGroup {
  id: number;           // e.g. 7248374
  t: string;            // Group Name, e.g. "Solo Leveling*"
  jc?: number;          // Joined member count (e.g. 3)
  mc?: number;          // Max Capacity limit (e.g. 10)
  on?: string;          // Owner Nickname
}

export interface YptApiMember {
  ud: number;           // Unique Permanent User ID (e.g. 14978048)
  n: string;            // Nickname (e.g. "sung jinwoo")
  ct?: string;          // Exam Category (e.g. "UG", "JEE")
  dl: {
    dd: string;         // Date YYYY-MM-DD
    sm: number;         // Today's total study time in MILLISECONDS
    mm: number;         // Max continuous study session in ms
    is: boolean;        // Is currently studying right now
    ia: boolean;        // Is currently away
  };
  cls?: Record<string, {
    id: number;
    st: number;         // 1 = Submitted photo, 0 = Pending
    la: string | null;  // ISO submission timestamp
  }>;
}

export interface YptApiNativeChallenge {
  id: number;           // e.g. 331805
  e: string;            // Emoji, e.g. "🍇"
  t: string;            // Title, e.g. "test 3"
  ct: string;           // CAMERA / CAMERA_AND_ALBUM
  csd: string;          // Start date ISO
  ced: string;          // End date ISO
}

export interface YptCustomRule {
  id: string;
  name: string; // e.g. "Morning Snap Bonus", "Target 5 Hours Bonus"
  emoji?: string; // e.g. "☀️", "🌻", "📱"
  nativeChallengeId?: number; // Linked native YPT photo challenge ID e.g. 331805
  points: number; // e.g. 5
  type: 'bonus' | 'penalty';
  conditionType?: YptRuleConditionType; // Default 'emoji_only'
  minHoursNeeded?: number; // Minimum hours required for 'hours_only', 'both', or 'either'
  scope?: 'individual' | 'team_all'; // 'individual' (default) vs 'team_all' (requires 100% team compliance)
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
  maxContinuousHoursThreshold?: number; // e.g. 4 hours
  maxContinuousPenaltyMode?: 'whole' | 'excess'; // 'whole' = penalize full session, 'excess' = penalize hours beyond threshold
  maxContinuousPenaltyMultiplier?: number; // e.g. 2 for 2x penalty
  maxContinuousPenaltyType?: 'variable' | 'fixed'; // 'variable' (interval/multiplier based) vs 'fixed' (flat deduction)
  maxContinuousFixedPenalty?: number; // Flat XP deduction amount when type is 'fixed' (e.g. 10)
  customRules?: YptCustomRule[];
}

export type YptChallengeScope = 'inner' | 'inter';
export type YptChallengeMode = 'team' | 'individual';

export interface YptTeamMemberRef {
  yptUd: number;             // Permanent YPT User ID
  yptHandle: string;          // Latest known YPT Nickname
  appUserId?: string;         // Linked Firebase User ID (if registered)
  hours?: number;             // Current peak daily study hours (high-water mark)
  studyMs?: number;           // Current peak daily study milliseconds
  isStudying?: boolean;       // Live study status from member.dl.is
  hasCompleted?: boolean;     // True if user completed the active challenge (st === 1 in cls)
  completedChallengeIds?: number[]; // Array of completed native challenge IDs from cls map
  lastSyncedAt?: string;      // ISO timestamp of last update
}

export interface YptTeam {
  id: string;
  name: string;
  color?: string;
  memberUids: string[];
  members?: YptTeamMemberRef[];
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
  isStudyingCurrently?: boolean;
  maxContinuousMs?: number;
  detectedEmojis?: string[];
  detectedRules?: Array<{
    ruleId?: string;
    ruleName: string;
    emoji: string;
    points: number;
  }>;
}

export interface YptDailyMemberSnapshot {
  handle: string;
  rawYptUd?: number;
  appUserId?: string;
  hoursStudied: number; // Highest recorded hours for this date
  studyMs: number;
  maxContinuousMs?: number; // Highest continuous study ms recorded from dl.mm
  isCurrentlyStudying: boolean; // From dl.is
  completedNativeChallengeIds: number[]; // From cls keys with st: 1

  // Point Computations
  basePoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  netPoints: number;
  appliedRuleBreakdown: Array<{
    ruleId: string;
    ruleName: string;
    emoji: string;
    points: number;
    type: 'bonus' | 'penalty' | 'base' | 'milestone';
  }>;

  status: 'active' | 'exempt' | 'penalty_exempt' | 'unsynced';
  lastSyncedAt: string;
}

export interface YptTeamStandingSnapshot {
  teamId: string;
  teamName: string;
  dayHours: number;
  dayPoints: number;
  rank: number;
}

export interface YptParticipantStandingSnapshot {
  yptUd?: number;
  yptHandle: string;
  appUserId?: string;
  dayHours: number;
  dayPoints: number;
  rank: number;
}

/**
 * Module 1: Firestore Daily Snapshot Schema (yptDailySnapshots)
 * Each challenge day gets a permanent, date-keyed snapshot document in Firestore:
 * yptChallenges/{challengeId}/dailySnapshots/{YYYY-MM-DD}
 */
export interface YptDailySnapshotDoc {
  id: string; // e.g. "2026-08-20" or "daily_2026-08-20"
  challengeId: string;
  dateYmd: string; // "2026-08-20" (corresponds to 5am Aug 20 -> 5am Aug 21 IST)
  isLocked: boolean; // true = finalized, false = live accumulation
  lockedAt?: string; // ISO timestamp
  lockedBy?: 'cron_system' | 'admin_manual';

  // Aggregate Stats
  totalChallengeHours: number;
  totalChallengePoints: number;
  activeMemberCount: number;

  // Per-Member Snapshots
  memberSnapshots: {
    [yptHandle: string]: YptDailyMemberSnapshot;
  };

  // Team Leaderboard Snapshot for that Day (Team Mode)
  teamStandings: Array<YptTeamStandingSnapshot>;

  // Individual Leaderboard Snapshot for that Day (Solo / Individual Mode)
  participantStandings?: Array<YptParticipantStandingSnapshot>;

  // Backwards-compatible fields
  targetDateYmd?: string;
  isAutoClosed?: boolean;
  closedAt?: number;
  totalPointsAwarded?: number;
  teamPointsMap?: Record<string, number>;
  highWaterMarks?: Record<string, number>;
  maxContinuousHighWaterMarks?: Record<string, number>;
  memberRecords?: Array<{
    yptHandle: string;
    userId?: string;
    teamId?: string;
    hoursStudied: number;
    basePoints: number;
    bonusPoints: number;
    penaltyPoints: number;
    netPoints: number;
    isCurrentlyStudying?: boolean;
    appliedRules: Array<{
      ruleId?: string;
      ruleName: string;
      emoji: string;
      points: number;
    }>;
    completedChallengeIds?: number[];
  }>;
}

// Alias for backwards compatibility
export type YptDailyDaySnapshot = YptDailySnapshotDoc;

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
  source?: 'ocr' | 'ypt_api' | 'manual';
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
  scope?: YptChallengeScope;   // 'inner' (1 group) or 'inter' (multi-group)
  mode?: YptChallengeMode;     // 'team' (default) or 'individual'
  targetGroupIds?: number[];   // YPT Group IDs involved
  nativeYptChallengeId?: number; // Optional linked YPT Native Challenge ID
  leaderUid: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'draft' | 'deleted';
  rules: YptRuleConfig;
  teams: YptTeam[];
  participants?: YptTeamMemberRef[]; // Direct member roster when mode is 'individual' (teams is empty)
  dailyHighWaterMarks?: Record<string, number>; // Permanent ud -> peak study milliseconds for active date
  dailyMaxContinuousHighWaterMarks?: Record<string, number>; // Permanent ud -> peak max continuous session ms for active date
  lastDailySnapshotDate?: string;
  lastCronSyncAt?: any;             // Timestamp/FieldValue of last automated cron sync
  lastSyncedAt?: string;            // ISO timestamp of last sync
  createdAt: string | number;
  updatedAt?: string | number;
  completedAt?: string;             // ISO timestamp when results were published
  completedBy?: string;             // User UID or handle of the admin who declared results
  winningTeamId?: string;           // Calculated top team ID at completion (team mode)
  winningParticipantUd?: number;    // Calculated top participant YPT User ID at completion (individual mode)
  winningParticipantHandle?: string;// Calculated top participant handle at completion (individual mode)
  finalMvpHandle?: string;          // MVP handle at completion
  isDeleted?: boolean;
  deletedAt?: string | number;
}
