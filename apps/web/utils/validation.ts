// utils/validation.ts
/**
 * Validation utilities for form fields across the application
 */

export interface ValidationError {
  [key: string]: string;
}

// Phone validation (Egyptian numbers)
export const validatePhone = (phone: string): string | null => {
  if (!phone) return 'رقم الهاتف مطلوب';
  
  // Accept formats: +201234567890, 201234567890, 01234567890
  const phoneRegex = /^(\+2|002)?01[0-2]\d{7}$/;
  
  if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
    return 'رقم الهاتف غير صحيح';
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
  
  if (name.trim().length < 3) {
    return `${fieldName} يجب أن يكون 3 أحرف على الأقل`;
  }
  
  if (name.trim().length > 100) {
    return `${fieldName} يجب أن لا يتجاوز 100 حرف`;
  }
  
  // Allow only letters, spaces, hyphens, and Arabic characters
  const nameRegex = /^[\u0600-\u06FFa-zA-Z\s\-']{3,100}$/;
  if (!nameRegex.test(name.trim())) {
    return `${fieldName} يحتوي على أحرف غير صالحة`;
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

// Textarea validation
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

// Normalize phone number for API
export const normalizePhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('20')) {
    return `+${cleaned}`;
  } else if (cleaned.startsWith('0')) {
    return `+20${cleaned.substring(1)}`;
  } else if (cleaned.startsWith('1')) {
    return `+201${cleaned.substring(1)}`;
  }
  
  return `+20${cleaned}`;
};

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
