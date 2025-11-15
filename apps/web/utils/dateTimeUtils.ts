/**
 * DateTime Utilities
 * Handles conversion and formatting of DateTime values to user's local timezone
 */

/**
 * Convert UTC DateTime string to local Date object
 * @param utcDateString - ISO string or date string from backend (UTC)
 * @returns Date object in local timezone
 */
export function toLocalDate(utcDateString: string | Date | undefined | null): Date | null {
  if (!utcDateString) return null;
  
  try {
    const date = typeof utcDateString === 'string' ? new Date(utcDateString) : utcDateString;
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/**
 * Format DateTime to local date string (Gregorian calendar with Arabic text)
 * @param date - Date object or ISO string
 * @returns Formatted date string in Gregorian calendar
 */
export function formatLocalDate(date: string | Date | undefined | null): string {
  const localDate = toLocalDate(date);
  if (!localDate) return 'لم يحدد';
  
  // Use en-US locale with Gregorian calendar, then translate to Arabic
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    calendar: 'gregory',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  
  const parts = formatter.formatToParts(localDate);
  const monthNames: { [key: string]: string } = {
    'January': 'يناير', 'February': 'فبراير', 'March': 'مارس', 'April': 'أبريل',
    'May': 'مايو', 'June': 'يونيو', 'July': 'يوليو', 'August': 'أغسطس',
    'September': 'سبتمبر', 'October': 'أكتوبر', 'November': 'نوفمبر', 'December': 'ديسمبر'
  };
  
  let result = '';
  for (const part of parts) {
    if (part.type === 'month') {
      result += monthNames[part.value] || part.value;
    } else {
      result += part.value;
    }
  }
  return result;
}

/**
 * Format DateTime to local date and time string (Gregorian calendar with Arabic text)
 * @param date - Date object or ISO string
 * @returns Formatted date and time string in Gregorian calendar
 */
export function formatLocalDateTime(date: string | Date | undefined | null): string {
  const localDate = toLocalDate(date);
  if (!localDate) return 'لم يحدد';
  
  // Use en-US locale with Gregorian calendar, then translate to Arabic
  const formatter = new Intl.DateTimeFormat('en-US', {
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
  
  const parts = formatter.formatToParts(localDate);
  const monthNames: { [key: string]: string } = {
    'January': 'يناير', 'February': 'فبراير', 'March': 'مارس', 'April': 'أبريل',
    'May': 'مايو', 'June': 'يونيو', 'July': 'يوليو', 'August': 'أغسطس',
    'September': 'سبتمبر', 'October': 'أكتوبر', 'November': 'نوفمبر', 'December': 'ديسمبر'
  };
  
  let result = '';
  for (const part of parts) {
    if (part.type === 'month') {
      result += monthNames[part.value] || part.value;
    } else {
      result += part.value;
    }
  }
  return result;
}

/**
 * Format DateTime to local time string (local timezone) in Arabic
 * @param date - Date object or ISO string
 * @returns Formatted time string in Arabic
 */
export function formatLocalTime(date: string | Date | undefined | null): string {
  const localDate = toLocalDate(date);
  if (!localDate) return 'لم يحدد';
  
  const formatter = new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  
  return formatter.format(localDate).replace(/ص/g, 'ص').replace(/م/g, 'م');
}

/**
 * Format DateTime to short date string (Gregorian calendar)
 * @param date - Date object or ISO string
 * @returns Short formatted date string (MM/DD/YYYY)
 */
export function formatShortDate(date: string | Date | undefined | null): string {
  const localDate = toLocalDate(date);
  if (!localDate) return 'لم يحدد';
  
  return localDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'gregory',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
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
    return `منذ ${diffMinutes} ${diffMinutes === 1 ? 'دقيقة' : 'دقائق'}`;
  } else if (diffHours < 24) {
    return `منذ ${diffHours} ${diffHours === 1 ? 'ساعة' : 'ساعات'}`;
  } else if (diffDays < 7) {
    return `منذ ${diffDays} ${diffDays === 1 ? 'يوم' : 'أيام'}`;
  } else {
    return formatLocalDate(date);
  }
}

