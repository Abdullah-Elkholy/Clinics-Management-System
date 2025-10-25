/**
 * Centralized Application Configuration
 * Single source of truth for all app-wide constants, defaults, and settings
 */

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================
export const FILE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5 MB
  ALLOWED_TYPES: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
  ALLOWED_EXTENSIONS: ['xls', 'xlsx', 'csv'],
  SAMPLE_DATA: [
    ['الاسم الكامل', 'كود الدولة', 'رقم الهاتف'],
    ['أحمد محمد علي', '+20', '01012345678'],
    ['فاطمة محمود السيد', '+20', '01087654321'],
    ['محمود حسن أحمد', '+20', '01098765432'],
    ['نور الدين إبراهيم', '+966', '0501234567'],
    ['سارة علي محمد', '+971', '0501234567'],
  ],
} as const;

// ============================================================================
// PHONE & COUNTRY CODE CONFIGURATION
// ============================================================================
export const PHONE_CONFIG = {
  DEFAULT_COUNTRY_CODE: '+20',
  PHONE_REGEX: /^\+\d{2,3}\d{8,12}$/,
  COUNTRY_CODE_REGEX: /^\+\d{2,3}$/,
  PHONE_INPUT_REGEX: /^(\+2|002)?01[0-2]\d{7}$/,
} as const;

// ============================================================================
// FORM VALIDATION CONFIGURATION
// ============================================================================
export const VALIDATION_CONFIG = {
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
    PATTERN: /^[\u0600-\u06FFa-zA-Z\s\-']+$/,
  },
  TEMPLATE: {
    TITLE_MIN: 3,
    TITLE_MAX: 100,
    CONTENT_MAX: 1000,
    CONTENT_MIN: 10,
  },
  TEXTAREA: {
    MAX_LENGTH: 500,
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
} as const;

// ============================================================================
// UI COMPONENT CONFIGURATION
// ============================================================================
export const UI_CONFIG = {
  // Modal sizing
  MODAL_SIZES: {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
  },

  // Toast types and colors
  TOAST_STYLES: {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: 'text-green-600',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-600',
    },
    warning: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-800',
      icon: 'text-orange-600',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-600',
    },
  },

  // Input field sizing
  INPUT_SIZES: {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-3 py-2 text-base',
  },

  // Button sizing
  BUTTON_SIZES: {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  },
} as const;

// ============================================================================
// STYLING CONSTANTS
// ============================================================================
export const STYLE_CONFIG = {
  // Tailwind class combinations for form inputs
  INPUT_BASE:
    'border rounded-lg focus:outline-none focus:ring-2 transition-all',
  INPUT_NORMAL:
    'border-gray-300 bg-white focus:ring-blue-500 hover:border-gray-400',
  INPUT_ERROR: 'border-red-400 bg-red-50 focus:ring-red-500',
  INPUT_SUCCESS: 'border-green-400 bg-green-50 focus:ring-green-500',
  INPUT_BLUE: 'border-blue-300 bg-blue-50 focus:ring-blue-500',

  // Tailwind class combinations for buttons
  BUTTON_BASE:
    'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
  BUTTON_PRIMARY:
    'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  BUTTON_SECONDARY:
    'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500',
  BUTTON_DANGER: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  BUTTON_SUCCESS:
    'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',

  // Common spacing patterns
  SPACING: {
    MODAL_PADDING: 'p-6',
    FORM_GAP: 'space-y-4',
    GRID_GAP: 'gap-4',
  },
} as const;

// ============================================================================
// ERROR MESSAGES (ARABIC)
// ============================================================================
export const ERROR_MESSAGES = {
  // File upload errors
  INVALID_FILE_TYPE: 'نوع الملف غير مدعوم. يرجى استخدام ملفات Excel أو CSV فقط',
  FILE_TOO_LARGE: (maxMB: number) =>
    `حجم الملف كبير جداً. الحد الأقصى ${maxMB} MB`,
  NO_DATA_IN_FILE: 'الملف يجب أن يحتوي على رأس أعمدة وبيانات',

  // Validation errors
  REQUIRED_FIELD: (fieldName: string) => `${fieldName} مطلوب`,
  INVALID_NAME: 'الاسم غير صحيح',
  INVALID_PHONE: 'رقم الهاتف غير صحيح',
  INVALID_EMAIL: 'البريد الإلكتروني غير صحيح',
  INVALID_COUNTRY_CODE: 'كود الدولة غير صحيح',
  INVALID_PHONE_FORMAT:
    'صيغة الهاتف غير صحيحة. يجب أن تكون: +كود الدولة + الرقم',
  MIN_LENGTH: (fieldName: string, length: number) =>
    `${fieldName} يجب أن يكون ${length} أحرف على الأقل`,
  MAX_LENGTH: (fieldName: string, length: number) =>
    `${fieldName} يجب أن لا يتجاوز ${length} حرف`,

  // Form errors
  PASSWORDS_NOT_MATCHING: 'كلمات المرور الجديدة غير متطابقة',
  ALL_FIELDS_REQUIRED: 'يرجى إدخال جميع البيانات',
  ALL_FIELDS_REQUIRED_MARKED: 'يرجى إدخال جميع البيانات المطلوبة',

  // Country code errors
  CUSTOM_CODE_FORMAT: 'يجب أن يبدأ بـ + متبوعاً بـ 2-3 أرقام',
  CUSTOM_CODE_REQUIRED: 'كود الدولة المخصص مطلوب',
} as const;

// ============================================================================
// SUCCESS MESSAGES (ARABIC)
// ============================================================================
export const SUCCESS_MESSAGES = {
  FILE_UPLOADED: (count: number) => `تم رفع الملف بنجاح - تم إضافة ${count} مريض`,
  ACCOUNT_UPDATED: 'تم تحديث معلومات الحساب بنجاح',
  USER_UPDATED: 'تم تحديث بيانات المستخدم بنجاح',
  QUEUE_CREATED: 'تم إنشاء الطابور بنجاح',
  TEMPLATE_CREATED: 'تم إنشاء القالب بنجاح',
  PATIENT_ADDED: 'تم إضافة المريض بنجاح',
  PATIENTS_ADDED: (count: number) => `تم إضافة ${count} مريض بنجاح`,
} as const;

// ============================================================================
// INFO MESSAGES (ARABIC)
// ============================================================================
export const INFO_MESSAGES = {
  FILE_SELECTED: (fileName: string) => `تم اختيار الملف: ${fileName}`,
  PROCESSING: 'جاري معالجة الملف...',
  SAMPLE_DOWNLOADED: 'تم تحميل النموذج بنجاح',
  CHARACTER_LIMIT: (current: number, max: number) =>
    `${current}/${max} حرف`,
  EXCEEDS_LIMIT: (max: number) =>
    `تم تجاوز الحد الأقصى للأحرف (${max})`,
} as const;

// ============================================================================
// API & DATA CONFIGURATION
// ============================================================================
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// ============================================================================
// FEATURE FLAGS
// ============================================================================
export const FEATURE_FLAGS = {
  ENABLE_OFFLINE_MODE: false,
  ENABLE_DARK_MODE: false,
  ENABLE_MULTI_LANGUAGE: false,
  DEBUG_MODE: process.env.NODE_ENV === 'development',
} as const;

// ============================================================================
// EXPORT TYPE-SAFE CONFIG GETTER
// ============================================================================
export type AppConfig = typeof FILE_UPLOAD_CONFIG &
  typeof PHONE_CONFIG &
  typeof VALIDATION_CONFIG &
  typeof UI_CONFIG &
  typeof STYLE_CONFIG;

export const getConfig = () => ({
  FILE_UPLOAD_CONFIG,
  PHONE_CONFIG,
  VALIDATION_CONFIG,
  UI_CONFIG,
  STYLE_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  INFO_MESSAGES,
  API_CONFIG,
  FEATURE_FLAGS,
});
