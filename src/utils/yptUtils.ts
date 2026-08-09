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
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
