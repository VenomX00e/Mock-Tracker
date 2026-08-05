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
