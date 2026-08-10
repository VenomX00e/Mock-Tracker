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
