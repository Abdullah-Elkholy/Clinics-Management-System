/**
 * DateTime Utilities
 * Handles conversion and formatting of DateTime values to user's local timezone
 * All numbers are formatted with Arabic-Indic numerals
 */

/**
 * Convert Western digits (0-9) to Arabic-Indic numerals (٠-٩)
 */
/**
 * Convert Western digits (0-9) to Arabic-Indic numerals (٠-٩)
 * @deprecated This function is now a pass-through to enforce English numerals
 */
function toArabicNumerals(str: string): string {
  // Return string as is to enforce English numerals
  return str;
}

/**
 * Parse a date string that might be in UTC but missing 'Z' suffix
 * This fixes issues where .NET/JSON dates are interpreted as local time
 */
export function parseAsUtc(dateString: string | Date | undefined | null): Date | undefined {
  if (!dateString) return undefined;

  // If it's already a Date object, return it (cloned)
  if ((dateString as any) instanceof Date) return new Date(dateString as any);

  let stringToParse = dateString;

  // If it looks like ISO standard format (T separator) but ends in digits (no Z/offset)
  // e.g. "2023-11-15T10:30:05.123" or "2023-11-15T10:30:05"
  if (typeof stringToParse === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(stringToParse)) {
    stringToParse += 'Z';
  }

  const date = new Date(stringToParse);
  if (isNaN(date.getTime())) return undefined;
  return date;
}

/**
 * Convert UTC DateTime string to local Date object
 * @param utcDateString - ISO string or date string from backend (UTC)
 * @returns Date object in local timezone
 */
export function toLocalDate(utcDateString: string | Date | undefined | null): Date | null {
  const date = parseAsUtc(utcDateString as any);
  return date || null;
}

/**
 * Format DateTime to local date string (Gregorian calendar with Arabic text)
 * @param date - Date object or ISO string
 * @returns Formatted date string in Gregorian calendar
 */
export function formatLocalDate(date: string | Date | undefined | null): string {
  const localDate = toLocalDate(date);
  if (!localDate) return 'لم يحدد';

  // Use ar-EG with Latin numbering system
  const formatter = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    calendar: 'gregory',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  return formatter.format(localDate);
  // No longer converting to Arabic-Indic numerals
  // return toArabicNumerals(result);
}

/**
 * Format DateTime to local date and time string (Gregorian calendar with Arabic text)
 * @param date - Date object or ISO string
 * @returns Formatted date and time string in Gregorian calendar
 */
export function formatLocalDateTime(date: string | Date | undefined | null): string {
  const localDate = toLocalDate(date);
  if (!localDate) return 'لم يحدد';

  // Use ar-EG with Latin numbering system
  const formatter = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    calendar: 'gregory',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const formatted = formatter.format(localDate);
  // Ensure AM/PM are Arabic
  return formatted
    .replace(/\bAM\b/g, 'ص')
    .replace(/\bPM\b/g, 'م')
    .replace(/\bam\b/g, 'ص')
    .replace(/\bpm\b/g, 'م');
  // return formatted;
}

/**
 * Format DateTime to local time string (local timezone) in Arabic
 * @param date - Date object or ISO string
 * @returns Formatted time string in Arabic
 */
export function formatLocalTime(date: string | Date | undefined | null): string {
  const localDate = toLocalDate(date);
  if (!localDate) return 'لم يحدد';

  const formatter = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const formatted = formatter.format(localDate).replace(/ص/g, 'ص').replace(/م/g, 'م');

  // No longer converting to Arabic-Indic numerals
  return formatted;
}

/**
 * Format DateTime to short date string (Gregorian calendar)
 * @param date - Date object or ISO string
 * @returns Short formatted date string (MM/DD/YYYY)
 */
export function formatShortDate(date: string | Date | undefined | null): string {
  const localDate = toLocalDate(date);
  if (!localDate) return 'لم يحدد';

  const formatted = localDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'gregory',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  // No longer converting to Arabic-Indic numerals
  return formatted;
}

/**
 * Get relative time string (e.g., "منذ ساعتين", "منذ 5 دقائق")
 * @param date - Date object or ISO string
 * @returns Relative time string in Arabic
 */
export function formatRelativeTime(date: string | Date | undefined | null): string {
  const localDate = toLocalDate(date);
  if (!localDate) return 'لم يحدد';

  const now = new Date();
  const diffMs = now.getTime() - localDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'الآن';
  } else if (diffMinutes < 60) {
    return `منذ ${toArabicNumerals(String(diffMinutes))} ${diffMinutes === 1 ? 'دقيقة' : 'دقائق'}`;
  } else if (diffHours < 24) {
    return `منذ ${toArabicNumerals(String(diffHours))} ${diffHours === 1 ? 'ساعة' : 'ساعات'}`;
  } else if (diffDays < 7) {
    return `منذ ${toArabicNumerals(String(diffDays))} ${diffDays === 1 ? 'يوم' : 'أيام'}`;
  } else {
    return formatLocalDate(date);
  }
}

/**
 * Get current date as UTC string (YYYY-MM-DD)
 * Useful for default values in date pickers when filtering backend data stored in UTC
 */
export function getUtcDateString(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
