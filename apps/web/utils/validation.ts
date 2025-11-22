// utils/validation.ts
/**
 * Validation utilities for form fields across the application
 */

export interface ValidationError {
  [key: string]: string;
}

// E.164 standard allows up to 15 digits for the national significant number (excluding the leading +)
// Total user-entered characters may include '+' plus up to 15 digits -> 16 visible chars.
// We expose the digit limit for inputs; UI components can add 1 if allowing the '+'.
export const MAX_PHONE_DIGITS = 15; // does NOT include leading '+'

// Phone validation - accepts 1 to 15 digits (E.164 compliant)
export const validatePhone = (phone: string): string | null => {
  if (!phone) return 'رقم الهاتف مطلوب';
  
  // Remove spaces and common separators
  const cleaned = phone.replace(/[\s\-()]/g, '');
  
  // Accept any combination of digits (with optional leading +) up to 15 digits
  // Examples: 01012345678, 201012345678, +201012345678, +966123456789
  const phoneRegex = /^(\+)?(\d{1,15})$/;
  
  if (!phoneRegex.test(cleaned)) {
    return 'رقم الهاتف غير صحيح';
  }
  
  const digitCount = cleaned.replace(/\D/g, '').length;
  if (digitCount < 7) {
    return 'رقم الهاتف قصير جداً';
  }
  if (digitCount > 15) {
    return 'رقم الهاتف طويل جداً';
  }
  
  return null;
};

// Email validation
export const validateEmail = (email: string): string | null => {
  if (!email) return null; // Optional field
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return 'البريد الإلكتروني غير صحيح';
  }
  
  return null;
};

// Name validation
export const validateName = (name: string, fieldName: string = 'الاسم'): string | null => {
  if (!name || !name.trim()) {
    return `${fieldName} مطلوب`;
  }

  // Normalize whitespace
  let normalized = name.trim();

  // Allow optional Arabic doctor prefix "د." at the start (with optional spaces): e.g., "د. أحمد" or "د . أحمد"
  // If present, strip the prefix for validation purposes only
  normalized = normalized.replace(/^\s*د\s*\.\s*/, '');

  if (normalized.length < 3) {
    return `${fieldName} يجب أن يكون 3 أحرف على الأقل`;
  }

  if (normalized.length > 100) {
    return `${fieldName} يجب أن لا يتجاوز 100 حرف`;
  }

  // Allow only letters (Arabic/English), spaces, hyphens, and apostrophes
  const nameRegex = /^[\u0600-\u06FFa-zA-Z\s\-']{3,100}$/;
  if (!nameRegex.test(normalized)) {
    return `${fieldName} يحتوي على أحرف غير صالحة`;
  }

  return null;
};

// Username validation
export const validateUsername = (username: string): string | null => {
  if (!username || !username.trim()) {
    return 'اسم المستخدم مطلوب';
  }

  if (username.trim().length < 3) {
    return 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل';
  }

  if (username.trim().length > 50) {
    return 'اسم المستخدم يجب أن لا يتجاوز 50 حرف';
  }

  // Check for spaces
  if (/\s/.test(username)) {
    return 'اسم المستخدم لا يمكن أن يحتوي على مسافات';
  }

  // Check if first character is a number
  if (/^[0-9]/.test(username)) {
    return 'اسم المستخدم يجب أن يبدأ بحرف إنجليزي';
  }

  // Allow only English letters, numbers (not first character), hyphens, and underscores
  // Do not allow two consecutive hyphens or underscores
  const usernameRegex = /^[a-zA-Z]([a-zA-Z0-9_-]*[a-zA-Z0-9])?$/;
  if (!usernameRegex.test(username.trim())) {
    return 'اسم المستخدم يحتوي على أحرف غير صالحة';
  }

  // Check for consecutive underscores or hyphens
  if (/([_-])\1/.test(username)) {
    return 'اسم المستخدم لا يمكن أن يحتوي على حرفين متتاليين من (_ أو -)';
  }

  return null;
};

// Date of birth validation
export const validateDateOfBirth = (date: string): string | null => {
  if (!date) return null; // Optional field
  
  const birthDate = new Date(date);
  const today = new Date();
  
  if (isNaN(birthDate.getTime())) {
    return 'التاريخ غير صحيح';
  }
  
  if (birthDate > today) {
    return 'التاريخ يجب أن يكون في الماضي';
  }
  
  const age = today.getFullYear() - birthDate.getFullYear();
  if (age > 120) {
    return 'التاريخ غير واقعي';
  }
  
  return null;
};

// Textarea validation (optional)
export const validateTextarea = (
  text: string,
  fieldName: string = 'النص',
  maxLength: number = 500
): string | null => {
  if (!text) return null; // Optional field
  
  if (text.length > maxLength) {
    return `${fieldName} يجب أن لا يتجاوز ${maxLength} حرف`;
  }
  
  return null;
};

// Textarea validation (required)
export const validateTextareaRequired = (
  text: string,
  fieldName: string = 'النص',
  maxLength: number = 500,
  minLength: number = 1
): string | null => {
  if (!text || !text.trim()) {
    return `${fieldName} مطلوب`;
  }
  
  if (text.trim().length < minLength) {
    return `${fieldName} يجب أن يكون ${minLength} أحرف على الأقل`;
  }
  
  if (text.length > maxLength) {
    return `${fieldName} يجب أن لا يتجاوز ${maxLength} حرف`;
  }
  
  return null;
};

// Generic required field validation
export const validateRequired = (value: string, fieldName: string = 'الحقل'): string | null => {
  if (!value || !value.trim()) {
    return `${fieldName} مطلوب`;
  }
  return null;
};

// Validate form and return all errors
export const validateForm = (formData: Record<string, any>, rules: Record<string, (value: any) => string | null>): ValidationError => {
  const errors: ValidationError = {};
  
  Object.keys(rules).forEach((fieldName) => {
    const error = rules[fieldName](formData[fieldName]);
    if (error) {
      errors[fieldName] = error;
    }
  });
  
  return errors;
};

// Check if form has any errors
export const hasErrors = (errors: ValidationError): boolean => {
  return Object.keys(errors).length > 0;
};

// Get first error field (for focus)
export const getFirstErrorField = (errors: ValidationError): string | null => {
  const keys = Object.keys(errors);
  return keys.length > 0 ? keys[0] : null;
};

// Format phone number for display
export const formatPhoneDisplay = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('20')) {
    // +20 format
    return `+${cleaned}`;
  } else if (cleaned.startsWith('0')) {
    // 0 format to +20 format
    return `+20${cleaned.substring(1)}`;
  }
  
  return phone;
};

// Phone number normalization removed - phone numbers are stored separately from country codes

// Validation rules templates for common use cases
export const validationRules = {
  // For AddQueueModal
  addQueue: {
    doctorName: (value: string) => validateName(value, 'اسم الطبيب'),
    clinicName: (value: string) => validateName(value, 'اسم العيادة'),
    phoneNumber: (value: string) => validatePhone(value),
    whatsappNumber: (value: string) => {
      if (!value) return null; // Optional
      return validatePhone(value);
    },
  },
  
  // For AddPatientModal
  addPatient: {
    name: (value: string) => validateName(value, 'اسم المريض'),
    phoneNumber: (value: string) => validatePhone(value),
    email: (value: string) => validateEmail(value),
    dateOfBirth: (value: string) => validateDateOfBirth(value),
    conditions: (value: string) => validateTextarea(value, 'الحالات الطبية', 500),
  },
  
  // For AddTemplateModal
  addTemplate: {
    templateName: (value: string) => validateName(value, 'اسم الرسالة'),
    templateText: (value: string) => {
      if (!value || !value.trim()) return 'نص الرسالة مطلوب';
      if (value.trim().length < 10) return 'النص يجب أن يكون 10 أحرف على الأقل';
      if (value.length > 1000) return 'النص يجب أن لا يتجاوز 1000 حرف';
      return null;
    },
    category: (value: string) => validateRequired(value, 'الفئة'),
  },
};

// Number validation for queue parameters
export const validateNumber = (
  value: string | number,
  fieldName: string = 'الرقم',
  min?: number,
  max?: number
): string | null => {
  if (value === '' || value === null || value === undefined) {
    return `${fieldName} مطلوب`;
  }
  
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  
  if (isNaN(num)) {
    return `${fieldName} يجب أن يكون رقماً`;
  }
  
  if (min !== undefined && num < min) {
    return `${fieldName} يجب أن يكون ${min} على الأقل`;
  }
  
  if (max !== undefined && num > max) {
    return `${fieldName} يجب أن لا يتجاوز ${max}`;
  }
  
  return null;
};

// Phone country code validation
export const validateCountryCode = (code: string, allowCustom: boolean = true): string | null => {
  if (!code || !code.trim()) {
    return 'كود الدولة مطلوب';
  }
  
  // Handle spaces in country code (remove them for validation)
  // This ensures validation works correctly even if spaces are present
  const trimmedCode = code.trim().replace(/\s/g, '');
  
  // Must start with +
  if (!trimmedCode.startsWith('+')) {
    return 'كود الدولة يجب أن يبدأ بـ +';
  }
  
  // Get digits only
  const digitsOnly = trimmedCode.substring(1);
  
  // Must contain only digits
  if (!/^\d+$/.test(digitsOnly)) {
    return 'كود الدولة يجب أن يحتوي على أرقام فقط بعد +';
  }
  
  // Check length (1-4 digits allowed for custom, 1-3 for predefined)
  const maxLength = allowCustom ? 4 : 3;
  if (digitsOnly.length < 1 || digitsOnly.length > maxLength) {
    return `كود الدولة يجب أن يكون 1-${maxLength} أرقام`;
  }
  
  return null;
};

// Excel cell value validation
export const validateCellValue = (
  value: string | number,
  columnName: string,
  rowIndex: number,
  columnIndex: number
): string | null => {
  // Convert to string
  const strValue = String(value).trim();
  
  if (!strValue) {
    return `الخلية في الصف ${rowIndex}, العمود ${columnIndex} فارغة`;
  }
  
  // Column-specific validations
  if (columnName === 'الاسم الكامل' || columnIndex === 1) {
    return validateName(strValue, 'الاسم');
  }
  
  if (columnName === 'رقم الهاتف' || columnIndex === 3) {
    return validatePhone(strValue);
  }
  
  if (columnName === 'كود الدولة' || columnIndex === 2) {
    return validateCountryCode(strValue);
  }
  
  return null;
};

// Batch validation for multiple cells
export const validateExcelRow = (
  row: (string | number)[],
  headers: string[]
): { hasErrors: boolean; errors: (string | null)[] } => {
  const errors = row.map((value, idx) => {
    // Skip order column (first column, optional)
    if (idx === 0) return null;
    
    const header = headers[idx];
    return validateCellValue(value, header, 0, idx);
  });
  
  return {
    hasErrors: errors.some((err) => err !== null),
    errors,
  };
};

// Sanitize input (remove dangerous characters)
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/"/g, '"'); // Normalize quotes
};

// Validate file name
export const validateFileName = (fileName: string): string | null => {
  if (!fileName) return 'اسم الملف مطلوب';
  
  const invalidChars = /[<>:"|?*/\\]/g;
  if (invalidChars.test(fileName)) {
    return 'اسم الملف يحتوي على أحرف غير صالحة';
  }
  
  return null;
};

// String length validation
export const validateLength = (
  value: string,
  fieldName: string = 'النص',
  minLength?: number,
  maxLength?: number
): string | null => {
  if (!value && (minLength && minLength > 0)) {
    return `${fieldName} مطلوب`;
  }
  
  if (minLength && value.length < minLength) {
    return `${fieldName} يجب أن يكون ${minLength} أحرف على الأقل`;
  }
  
  if (maxLength && value.length > maxLength) {
    return `${fieldName} يجب أن لا يتجاوز ${maxLength} حرف`;
  }
  
  return null;
};

// Extended validation rules
export const extendedValidationRules = {
  // For CQP (Current Queue Position)
  cqp: (value: string | number) => validateNumber(value, 'الموضع الحالي', 1, 1000),
  
  // For ETS (Estimated Time Per Session)
  ets: (value: string | number) => validateNumber(value, 'الوقت المقدر لكل كشف', 1, 600),
  
  // For cell editing in tables
  cellEdit: (value: string, columnIndex: number) => {
    if (!value.trim()) return 'القيمة مطلوبة';
    return null;
  },
};

