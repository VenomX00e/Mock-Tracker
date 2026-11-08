import { calculatePointsFromRules } from '../services/ypt/yptPointEngine.js';

/**
 * Formats a decimal hours duration (e.g., 7.205) into "H:MM" format (e.g., "7:12").
 */
export function formatStudyDuration(decimalHours: number): string {
  if (typeof decimalHours !== 'number' || isNaN(decimalHours) || decimalHours <= 0) {
    return '0:00';
  }
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m < 10 ? '0' : ''}${m}`;
}

/**
 * Returns current date/time converted to Indian Standard Time (IST, UTC+5:30).
 * Creates a Date object whose UTC methods (getUTCHours, etc.) reflect IST values.
 */
export function getIstDate(dateInput: Date | string | number = new Date()): Date {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return new Date();
  const utcMs = d.getTime();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(utcMs + istOffsetMs);
}

/**
 * Principle A: Native YPT Day Cycle (5:00 AM IST Boundary)
 * - Start of Day: 05:00:00 AM IST
 * - End of Day:   04:59:59 AM IST (Next Day)
 * - Active Session Crossing: Sessions starting in the night and ending between 05:00 AM and 05:20 AM IST
 *   are attributed to yesterday's log.
 * 
 * Returns the YPT calendar day YYYY-MM-DD for any date/time in IST.
 * 
 * Mathematical offset formula:
 * 1. Convert to UTC milliseconds.
 * 2. Add +5.5 hours for IST.
 * 3. Subtract -5.0 hours for the 5:00 AM reset boundary.
 * 4. Combined offset = +0.5 hours (30 minutes) relative to UTC.
 */
export function getYptDayYmd(dateInput: Date | string | number = new Date()): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return getYptDayYmd(new Date());

  const utcMs = d.getTime();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const rolloverOffsetMs = -5 * 60 * 60 * 1000;
  const shiftedMs = utcMs + istOffsetMs + rolloverOffsetMs;

  const shiftedDate = new Date(shiftedMs);
  const yyyy = shiftedDate.getUTCFullYear();
  const mm = String(shiftedDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shiftedDate.getUTCDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns yesterday's YPT calendar day YYYY-MM-DD relative to current YPT Day.
 */
export function getYesterdayYptDayYmd(dateInput: Date | string | number = new Date()): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return getYesterdayYptDayYmd(new Date());

  const utcMs = d.getTime();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const rolloverOffsetMs = -5 * 60 * 60 * 1000;
  const previousDayOffsetMs = -24 * 60 * 60 * 1000;
  const shiftedMs = utcMs + istOffsetMs + rolloverOffsetMs + previousDayOffsetMs;

  const shiftedDate = new Date(shiftedMs);
  const yyyy = shiftedDate.getUTCFullYear();
  const mm = String(shiftedDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shiftedDate.getUTCDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Checks if current time in IST is within the 15-20 minute post-5:00 AM reconciliation buffer (05:00 AM - 05:20 AM IST).
 * During this buffer, active sessions that started before 05:00 AM are allowed to complete and finalize yesterday's log.
 */
export function isYptReconciliationWindow(dateInput: Date | string | number = new Date()): boolean {
  const ist = getIstDate(dateInput);
  const istHours = ist.getUTCHours();
  const istMins = ist.getUTCMinutes();
  return istHours === 5 && istMins <= 20;
}

/**
 * Principle B: The "High-Water Mark" Non-Destructive Update Pattern
 * Formula: Math.max(previousHours || 0, incomingHours || 0)
 * Why: When YPT wipes dl.sm to 0 at 5:00 AM, the database retains the peak accumulated hours from earlier in the night.
 */
export function applyHighWaterMark(previousHours: number = 0, incomingHours: number = 0): number {
  const prev = typeof previousHours === 'number' && !isNaN(previousHours) ? Math.max(0, previousHours) : 0;
  const inc = typeof incomingHours === 'number' && !isNaN(incomingHours) ? Math.max(0, incomingHours) : 0;
  return Math.round(Math.max(prev, inc) * 100) / 100;
}

/**
 * Safely extracts today's study duration in hours from a YPT API member object.
 * Handles both base accumulated study duration (`dl.sm` in ms) and active real-time ongoing sessions.
 */
export function getMemberStudyHoursFromApi(member: any): number {
  if (!member) return 0;

  // 1. Base completed/accumulated study time in milliseconds
  let baseMs = 0;
  if (member.dl && typeof member.dl.sm === 'number' && member.dl.sm > 0) {
    baseMs = member.dl.sm;
  } else if (typeof member.sm === 'number' && member.sm > 0) {
    baseMs = member.sm;
  } else if (typeof member.tt === 'number' && member.tt > 0) {
    baseMs = member.tt;
  } else if (typeof member.studyTime === 'number' && member.studyTime > 0) {
    baseMs = member.studyTime;
  }

  // If baseMs was passed as seconds (< 100,000 for realistic daytime study durations), normalize to ms
  if (baseMs > 0 && baseMs < 100000) {
    baseMs = baseMs * 1000;
  }

  // 2. Active Live Session Timer (when member is currently studying live in real-time)
  // YPT provides start timestamp in fields like started_at, startedAt, c_st, start_time, startTime, st
  const rawStart =
    member.started_at ||
    member.startedAt ||
    member.c_st ||
    member.start_time ||
    member.startTime ||
    member.start ||
    (typeof member.st === 'number' && member.st > 1000000000 ? member.st : undefined);

  let activeMs = 0;
  if (rawStart) {
    let startEpochMs = Number(rawStart);
    // If timestamp in seconds, convert to milliseconds
    if (startEpochMs > 0 && startEpochMs < 10000000000) {
      startEpochMs = startEpochMs * 1000;
    }
    const now = Date.now();
    if (startEpochMs > 0 && startEpochMs <= now) {
      const elapsed = now - startEpochMs;
      // Cap at 24 hours to guard against anomalous stale timestamps
      if (elapsed > 0 && elapsed < 24 * 3600 * 1000) {
        activeMs = elapsed;
      }
    }
  }

  const totalMs = baseMs + activeMs;
  if (totalMs > 0) {
    return totalMs / (1000 * 3600);
  }

  return 0;
}

/**
 * Returns YYYY-MM-DD string for a local Date object.
 */
export function getLocalYmd(dateInput: Date | string | number): string {
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return match[1];
    }
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Safely extracts YYYY-MM-DD from any date, string, or Firestore timestamp object
 * without suffering UTC midnight or timezone shift bugs.
 */
export function getYmdFromDateOrString(val: any): string {
  if (!val) return getLocalYmd(new Date());

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }

  let d: Date | null = null;
  let isoYmd = '';

  if (typeof val === 'string') {
    const trimmed = val.trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      isoYmd = match[1];
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  } else if (typeof val === 'object' && val !== null) {
    if (typeof val.toDate === 'function') {
      d = val.toDate();
    } else if (typeof val.seconds === 'number') {
      d = new Date(val.seconds * 1000);
    } else if (val instanceof Date) {
      d = val;
    }
  } else if (typeof val === 'number') {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }

  let localYmd = '';
  if (d && !isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    localYmd = `${year}-${month}-${day}`;
  }

  if (isoYmd && localYmd) {
    // If localYmd shifted to previous day (e.g., UTC midnight in US) or isoYmd shifted back due to 18:30 UTC IST offset,
    // take the maximum of isoYmd and localYmd so the end date is never truncated.
    return localYmd > isoYmd ? localYmd : isoYmd;
  }

  if (localYmd) return localYmd;
  if (isoYmd) return isoYmd;

  return getLocalYmd(new Date());
}

/**
 * Safely formats YYYY-MM-DD or date/timestamp into local display date string (e.g., "Aug 6, 2026")
 * without suffering timezone shift bugs.
 */
export function formatDisplayYmd(val: any, options?: Intl.DateTimeFormatOptions): string {
  if (!val) return '';
  const ymd = getYmdFromDateOrString(val);
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return String(val);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString(undefined, options || { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getChallengeStartDateYmd(ch?: { startDate?: any; createdAt?: any } | null): string {
  if (!ch) {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalYmd(d);
  }
  const raw = ch.startDate || ch.createdAt;
  if (!raw) {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalYmd(d);
  }
  return getYmdFromDateOrString(raw);
}

export function getChallengeEndDateYmd(ch?: { endDate?: any } | null): string {
  if (!ch || !ch.endDate) {
    return getLocalYmd(new Date());
  }
  return getYmdFromDateOrString(ch.endDate);
}

/**
 * Normalizes a handle string for robust comparisons.
 */
export function normalizeHandle(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/^@/, '')
    .normalize('NFKC')
    .replace(/[\uFE00-\uFE0F\u200B-\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Extracts alphanumeric characters only from a handle string.
 */
export function extractAlpha(str: string): string {
  if (!str) return '';
  return normalizeHandle(str).replace(/[^a-z0-9]/g, '');
}

/**
 * Robust multi-tier handle matching function between raw OCR handles,
 * registered user names, and challenge team handles.
 */
export function areYptHandlesMatching(
  handleA?: string,
  handleB?: string,
  uidA?: string,
  uidB?: string
): boolean {
  // 1. UID match if provided
  if (uidA && uidB && uidA.trim().toLowerCase() === uidB.trim().toLowerCase()) {
    return true;
  }
  if (uidA && handleB && uidA.trim().toLowerCase() === handleB.replace(/^@/, '').trim().toLowerCase()) {
    return true;
  }
  if (uidB && handleA && uidB.trim().toLowerCase() === handleA.replace(/^@/, '').trim().toLowerCase()) {
    return true;
  }

  if (!handleA || !handleB) return false;

  const rawA = handleA.trim().toLowerCase().replace(/^@/, '');
  const rawB = handleB.trim().toLowerCase().replace(/^@/, '');

  // 2. Direct clean raw match
  if (rawA === rawB) return true;

  // 3. Normalized match
  const normA = normalizeHandle(handleA);
  const normB = normalizeHandle(handleB);
  if (normA && normA === normB) return true;

  // 4. Space-stripped normalized match (e.g. "the nun 👻" vs "the nun👻")
  const noSpaceA = normA.replace(/\s+/g, '');
  const noSpaceB = normB.replace(/\s+/g, '');
  if (noSpaceA && noSpaceA === noSpaceB) return true;

  // 5. Alphanumeric match (if length >= 2)
  const alphaA = extractAlpha(handleA);
  const alphaB = extractAlpha(handleB);
  if (alphaA && alphaB && alphaA.length >= 2 && alphaA === alphaB) return true;

  // 6. Substring/prefix match when emojis/badges differ (e.g. "thenun" vs "thenun👻")
  if (alphaA && alphaB && alphaA.length >= 3 && alphaB.length >= 3) {
    if (noSpaceA.startsWith(noSpaceB) || noSpaceB.startsWith(noSpaceA)) return true;
  }

  return false;
}

/**
 * Module 3: Rule Evaluation & False-Penalty Prevention Engine
 * Evaluates points for a member on a target date with strict false-penalty prevention rules:
 * 1. Checks if member joined after the target date -> Fully exempt (0 net points)
 * 2. Unlocked / Live Day with 0 hours -> Does NOT apply penalties while day is actively accumulating
 * 3. Penalties are ONLY applied when the day is officially locked/finalized or past closed
 * 4. Normal point calculation for study intervals + custom bonuses & penalties via canonical calculatePointsFromRules
 */
export interface CalculatedDailyMemberPoints {
  basePoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  netPoints: number;
  appliedRules: Array<{
    ruleId?: string;
    ruleName: string;
    emoji: string;
    points: number;
    type?: 'bonus' | 'penalty' | 'base' | 'milestone' | 'exempt';
  }>;
  isExempt?: boolean;
}

export function evaluateMemberDailyPoints(
  hours: number,
  rules: any = {},
  completedNativeChallengeIds: number[] = [],
  isDayLocked: boolean = false,
  memberJoinDateYmd?: string,
  targetDateYmd?: string,
  detectedEmojis: string[] = [],
  hasSnap: boolean = false,
  maxContinuousMs: number = 0
): CalculatedDailyMemberPoints {
  const safeHours = typeof hours === 'number' && !isNaN(hours) && hours > 0 ? hours : 0;

  // 1. Check if member joined AFTER this date -> Fully Exempt
  if (memberJoinDateYmd && targetDateYmd && targetDateYmd < memberJoinDateYmd) {
    return {
      basePoints: 0,
      bonusPoints: 0,
      penaltyPoints: 0,
      netPoints: 0,
      appliedRules: [
        {
          ruleId: 'exempt_joined_after',
          ruleName: 'Joined After This Date (Exempt)',
          emoji: '🛡️',
          points: 0,
          type: 'exempt',
        },
      ],
      isExempt: true,
    };
  }

  // 2. Unlocked / Live Day with 0 hours -> Do NOT apply penalties yet!
  if (!isDayLocked && safeHours === 0) {
    return {
      basePoints: 0,
      bonusPoints: 0,
      penaltyPoints: 0,
      netPoints: 0,
      appliedRules: [],
    };
  }

  // 3. Delegate to canonical point engine
  const calculated = calculatePointsFromRules(
    safeHours,
    rules,
    detectedEmojis,
    hasSnap,
    completedNativeChallengeIds,
    isDayLocked,
    maxContinuousMs
  );

  return {
    basePoints: calculated.baseStudyPoints,
    bonusPoints: calculated.bonusPoints,
    penaltyPoints: calculated.penaltyPoints,
    netPoints: calculated.netPoints,
    appliedRules: calculated.appliedRules,
  };
}

