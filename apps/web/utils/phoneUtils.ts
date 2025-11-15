/**
 * Phone number formatting utilities
 */

/**
 * Country-specific phone number handling rules
 */
const COUNTRY_PHONE_RULES: Record<string, { removeLeadingZero: boolean; minLength: number; maxLength: number }> = {
  '20': { removeLeadingZero: true, minLength: 9, maxLength: 11 }, // Egypt
  '966': { removeLeadingZero: true, minLength: 8, maxLength: 10 }, // Saudi Arabia
  '971': { removeLeadingZero: true, minLength: 8, maxLength: 10 }, // UAE
  '965': { removeLeadingZero: true, minLength: 7, maxLength: 9 }, // Kuwait
  '973': { removeLeadingZero: true, minLength: 7, maxLength: 9 }, // Bahrain
  '974': { removeLeadingZero: true, minLength: 7, maxLength: 9 }, // Qatar
  '968': { removeLeadingZero: true, minLength: 7, maxLength: 9 }, // Oman
  '961': { removeLeadingZero: true, minLength: 7, maxLength: 9 }, // Lebanon
  '962': { removeLeadingZero: true, minLength: 8, maxLength: 10 }, // Jordan
  '212': { removeLeadingZero: true, minLength: 8, maxLength: 10 }, // Morocco
  '213': { removeLeadingZero: true, minLength: 8, maxLength: 10 }, // Algeria
  '216': { removeLeadingZero: true, minLength: 7, maxLength: 9 }, // Tunisia
  '218': { removeLeadingZero: true, minLength: 8, maxLength: 10 }, // Libya
  '249': { removeLeadingZero: true, minLength: 8, maxLength: 10 }, // Sudan
  '252': { removeLeadingZero: true, minLength: 7, maxLength: 10 }, // Somalia
  '1': { removeLeadingZero: false, minLength: 9, maxLength: 11 }, // US/Canada
  '44': { removeLeadingZero: true, minLength: 9, maxLength: 11 }, // UK
  '33': { removeLeadingZero: true, minLength: 8, maxLength: 10 }, // France
  '49': { removeLeadingZero: true, minLength: 9, maxLength: 12 }, // Germany
};

/**
 * Format phone number for display with country code
 * Handles cases where phone might already include country code or have leading 0
 * Removes leading zero based on country-specific rules
 */
export function formatPhoneForDisplay(phone: string, countryCode: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  let cleaned = phone.replace(/[^\d]/g, '');
  
  // Extract country code digits (without +)
  const countryCodeDigits = countryCode.replace(/[^\d]/g, '');
  
  // If phone already starts with country code digits, remove them
  if (cleaned.startsWith(countryCodeDigits)) {
    cleaned = cleaned.substring(countryCodeDigits.length);
  }
  
  // Get country-specific rules or use default
  const rules = COUNTRY_PHONE_RULES[countryCodeDigits] || { removeLeadingZero: true, minLength: 8, maxLength: 15 };
  
  // Remove leading zero if country rules require it
  if (rules.removeLeadingZero && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Format as: +countryCode phoneNumber (with space)
  return `${countryCode} ${cleaned}`;
}

