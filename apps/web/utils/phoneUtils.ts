/**
 * Phone number formatting utilities
 */

/**
 * Country-specific phone number handling rules with digit ranges
 * Supports ranges for flexibility (e.g., Egypt: 9-11 digits instead of exactly 10)
 */
const COUNTRY_PHONE_RULES: Record<string, { removeLeadingZero: boolean; minLength: number; maxLength: number; placeholder: string }> = {
  // Middle East & North Africa
  '20': { removeLeadingZero: true, minLength: 9, maxLength: 11, placeholder: '1018542431' }, // Egypt
  '966': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '504858694' }, // Saudi Arabia
  '971': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '501234567' }, // UAE
  '965': { removeLeadingZero: true, minLength: 7, maxLength: 9, placeholder: '50123456' }, // Kuwait
  '973': { removeLeadingZero: true, minLength: 7, maxLength: 9, placeholder: '36123456' }, // Bahrain
  '974': { removeLeadingZero: true, minLength: 7, maxLength: 9, placeholder: '33123456' }, // Qatar
  '968': { removeLeadingZero: true, minLength: 7, maxLength: 9, placeholder: '92123456' }, // Oman
  '961': { removeLeadingZero: true, minLength: 7, maxLength: 9, placeholder: '3123456' }, // Lebanon
  '962': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '791234567' }, // Jordan
  '212': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '612345678' }, // Morocco
  '213': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '551234567' }, // Algeria
  '216': { removeLeadingZero: true, minLength: 7, maxLength: 9, placeholder: '20123456' }, // Tunisia
  '218': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '912345678' }, // Libya
  '249': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '912345678' }, // Sudan
  '252': { removeLeadingZero: true, minLength: 7, maxLength: 10, placeholder: '712345678' }, // Somalia
  '964': { removeLeadingZero: true, minLength: 8, maxLength: 11, placeholder: '7901234567' }, // Iraq
  '967': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '712345678' }, // Yemen
  '970': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '591234567' }, // Palestine
  '963': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '931234567' }, // Syria
  
  // Europe
  '44': { removeLeadingZero: true, minLength: 9, maxLength: 11, placeholder: '7912345678' }, // UK
  '33': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '612345678' }, // France
  '49': { removeLeadingZero: true, minLength: 9, maxLength: 12, placeholder: '15123456789' }, // Germany
  '39': { removeLeadingZero: true, minLength: 8, maxLength: 11, placeholder: '3123456789' }, // Italy
  '34': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '612345678' }, // Spain
  '31': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '612345678' }, // Netherlands
  '32': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '471234567' }, // Belgium
  '41': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '781234567' }, // Switzerland
  '43': { removeLeadingZero: true, minLength: 8, maxLength: 12, placeholder: '66412345678' }, // Austria
  '46': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '701234567' }, // Sweden
  '47': { removeLeadingZero: true, minLength: 7, maxLength: 9, placeholder: '91234567' }, // Norway
  '45': { removeLeadingZero: true, minLength: 7, maxLength: 9, placeholder: '20123456' }, // Denmark
  '358': { removeLeadingZero: true, minLength: 8, maxLength: 11, placeholder: '501234567' }, // Finland
  '7': { removeLeadingZero: false, minLength: 9, maxLength: 11, placeholder: '9123456789' }, // Russia
  
  // Americas
  '1': { removeLeadingZero: false, minLength: 9, maxLength: 11, placeholder: '2025551234' }, // US/Canada
  '52': { removeLeadingZero: true, minLength: 9, maxLength: 11, placeholder: '5512345678' }, // Mexico
  '55': { removeLeadingZero: true, minLength: 9, maxLength: 12, placeholder: '11987654321' }, // Brazil
  '54': { removeLeadingZero: true, minLength: 9, maxLength: 11, placeholder: '91123456789' }, // Argentina
  '56': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '912345678' }, // Chile
  '57': { removeLeadingZero: true, minLength: 9, maxLength: 11, placeholder: '3001234567' }, // Colombia
  '51': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '987654321' }, // Peru
  
  // Asia
  '91': { removeLeadingZero: true, minLength: 9, maxLength: 11, placeholder: '9876543210' }, // India
  '86': { removeLeadingZero: true, minLength: 9, maxLength: 12, placeholder: '13800138000' }, // China
  '81': { removeLeadingZero: true, minLength: 9, maxLength: 11, placeholder: '9012345678' }, // Japan
  '82': { removeLeadingZero: true, minLength: 8, maxLength: 11, placeholder: '1012345678' }, // South Korea
  '65': { removeLeadingZero: true, minLength: 7, maxLength: 9, placeholder: '91234567' }, // Singapore
  '60': { removeLeadingZero: true, minLength: 8, maxLength: 11, placeholder: '123456789' }, // Malaysia
  '66': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '812345678' }, // Thailand
  '84': { removeLeadingZero: true, minLength: 8, maxLength: 11, placeholder: '9123456789' }, // Vietnam
  '62': { removeLeadingZero: true, minLength: 8, maxLength: 12, placeholder: '8123456789' }, // Indonesia
  '63': { removeLeadingZero: true, minLength: 9, maxLength: 11, placeholder: '9123456789' }, // Philippines
  '92': { removeLeadingZero: true, minLength: 9, maxLength: 11, placeholder: '3001234567' }, // Pakistan
  '880': { removeLeadingZero: true, minLength: 9, maxLength: 11, placeholder: '1712345678' }, // Bangladesh
  
  // Africa
  '234': { removeLeadingZero: true, minLength: 9, maxLength: 11, placeholder: '8021234567' }, // Nigeria
  '27': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '821234567' }, // South Africa
  '254': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '712345678' }, // Kenya
  '233': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '241234567' }, // Ghana
  '256': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '712345678' }, // Uganda
  
  // Oceania
  '61': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '412345678' }, // Australia
  '64': { removeLeadingZero: true, minLength: 8, maxLength: 10, placeholder: '211234567' }, // New Zealand
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
  const rules = COUNTRY_PHONE_RULES[countryCodeDigits] || { removeLeadingZero: true, minLength: 8, maxLength: 15, placeholder: '123456789' };
  
  // Remove leading zero if country rules require it
  if (rules.removeLeadingZero && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Format as: +countryCode phoneNumber (with space)
  return `${countryCode} ${cleaned}`;
}

/**
 * Get phone placeholder for a country code
 * @param countryCode - Country code (e.g., "+20", "+966")
 * @returns Placeholder example or default placeholder
 */
export function getPhonePlaceholder(countryCode: string): string {
  if (!countryCode || countryCode === 'OTHER') {
    return '123456789';
  }
  
  // Extract country code digits (without +)
  const countryCodeDigits = countryCode.replace(/[^\d]/g, '');
  
  // Get country-specific rules or use default
  const rules = COUNTRY_PHONE_RULES[countryCodeDigits];
  return rules?.placeholder || '123456789';
}

/**
 * Validate phone number by country code (digit range validation)
 * @param phone - Phone number to validate
 * @param countryCode - Country code (e.g., "+20", "+966")
 * @returns Error message or null if valid
 */
export function validatePhoneByCountry(phone: string, countryCode: string): string | null {
  if (!phone) return 'رقم الهاتف مطلوب';
  
  // Handle spaces in phone number (remove them instead of rejecting)
  const phoneCleaned = phone.replace(/\s/g, '');
  
  // If country code is "OTHER", use generic validation
  if (!countryCode || countryCode === 'OTHER') {
    const cleaned = phoneCleaned.replace(/\D/g, '');
    if (cleaned.length < 7 || cleaned.length > 15) {
      return 'رقم الهاتف يجب أن يكون بين 7 و 15 رقم';
    }
    return null;
  }
  
  // Handle spaces in country code (remove them instead of rejecting)
  const countryCodeCleaned = countryCode.replace(/\s/g, '');
  
  // Extract country code digits (without +)
  const countryCodeDigits = countryCodeCleaned.replace(/[^\d]/g, '');
  
  // Get country-specific rules
  const rules = COUNTRY_PHONE_RULES[countryCodeDigits];
  if (!rules) {
    // Unknown country - use generic validation
    const cleaned = phoneCleaned.replace(/\D/g, '');
    if (cleaned.length < 7 || cleaned.length > 15) {
      return 'رقم الهاتف يجب أن يكون بين 7 و 15 رقم';
    }
    return null;
  }
  
  // Remove country code if present in phone number
  let cleaned = phoneCleaned.replace(/\D/g, '');
  if (cleaned.startsWith(countryCodeDigits)) {
    cleaned = cleaned.substring(countryCodeDigits.length);
  }
  
  // Remove leading zero if country rules require it
  if (rules.removeLeadingZero && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Validate digit length against country-specific rules
  if (cleaned.length < rules.minLength || cleaned.length > rules.maxLength) {
    return `رقم الهاتف لـ ${countryCodeCleaned} يجب أن يكون بين ${rules.minLength} و ${rules.maxLength} رقم`;
  }
  
  return null;
}

