/**
 * Number Utilities
 * Handles formatting numbers in Arabic format with Arabic-Indic numerals
 */

/**
 * Convert Western digits (0-9) to Arabic-Indic numerals (٠-٩)
 */
function toArabicNumerals(num: string | number): string {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/\d/g, (digit) => arabicNumerals[parseInt(digit)]);
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

  // Format using Arabic locale for proper grouping
  const formatted = new Intl.NumberFormat('ar-SA', {
    ...options,
  }).format(num);

  // Convert to Arabic-Indic numerals
  return toArabicNumerals(formatted);
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

