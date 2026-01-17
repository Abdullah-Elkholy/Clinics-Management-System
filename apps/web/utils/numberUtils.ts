/**
 * Number Utilities
 * Handles formatting numbers in Arabic format with Arabic-Indic numerals
 */

/**
 * Convert Western digits (0-9) to Arabic-Indic numerals (٠-٩)
 */
/**
 * Convert Western digits (0-9) to Arabic-Indic numerals (٠-٩)
 * @deprecated This function is now a pass-through to enforce English numerals
 */
function toArabicNumerals(num: string | number): string {
  // Return string as is to enforce English numerals
  return String(num);
}

/**
 * Format a number with Arabic-Indic numerals and Arabic locale formatting
 * @param value - Number to format
 * @param options - Intl.NumberFormatOptions
 * @returns Formatted number string with Arabic-Indic numerals
 */
export function formatArabicNumber(
  value: number | string | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return String(value);
  }

  // Format using Arabic locale with Latin numbering system
  const formatted = new Intl.NumberFormat('ar-EG-u-nu-latn', {
    ...options,
  }).format(num);

  // No longer converting to Arabic-Indic numerals
  return formatted;
}

/**
 * Format a number with Arabic-Indic numerals (simple version without grouping)
 * @param value - Number to format
 * @returns Formatted number string with Arabic-Indic numerals
 */
export function formatArabicNumberSimple(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return String(value);
  }

  return toArabicNumerals(String(num));
}

/**
 * Format a percentage with Arabic-Indic numerals
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string with Arabic-Indic numerals
 */
export function formatArabicPercentage(value: number, decimals: number = 0): string {
  if (isNaN(value)) {
    return '—';
  }

  const formatted = value.toFixed(decimals);
  return `${toArabicNumerals(formatted)}%`;
}

