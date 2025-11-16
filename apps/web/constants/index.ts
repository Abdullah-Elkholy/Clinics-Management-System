export const TEST_CREDENTIALS = {
  ADMIN: {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    firstName: 'محمد',
    lastName: 'الإدارة',
  },
  ADMIN2: {
    username: 'admin2',
    password: 'admin123',
    role: 'admin2',
    firstName: 'أحمد',
    lastName: 'الإدارة',
  },
  MODERATOR: {
    username: 'mod1',
    password: 'mod123',
    role: 'moderator',
    firstName: 'علي',
    lastName: 'المشرف',
  },
  USER: {
    username: 'user1',
    password: 'user123',
    role: 'user',
    firstName: 'سارة',
    lastName: 'المستخدم',
  },
};

export const COUNTRY_CODES = [
  // Middle East & North Africa (الشرق الأوسط وشمال أفريقيا)
  { code: '+20', country: 'EG', countryName: 'مصر' },
  { code: '+966', country: 'SA', countryName: 'السعودية' },
  { code: '+971', country: 'AE', countryName: 'الإمارات' },
  { code: '+968', country: 'OM', countryName: 'عمان' },
  { code: '+965', country: 'KW', countryName: 'الكويت' },
  { code: '+974', country: 'QA', countryName: 'قطر' },
  { code: '+973', country: 'BH', countryName: 'البحرين' },
  { code: '+212', country: 'MA', countryName: 'المغرب' },
  { code: '+216', country: 'TN', countryName: 'تونس' },
  { code: '+213', country: 'DZ', countryName: 'الجزائر' },
  { code: '+962', country: 'JO', countryName: 'الأردن' },
  { code: '+961', country: 'LB', countryName: 'لبنان' },
  { code: '+964', country: 'IQ', countryName: 'العراق' },
  { code: '+967', country: 'YE', countryName: 'اليمن' },
  { code: '+970', country: 'PS', countryName: 'فلسطين' },
  { code: '+963', country: 'SY', countryName: 'سوريا' },
  { code: '+218', country: 'LY', countryName: 'ليبيا' },
  { code: '+249', country: 'SD', countryName: 'السودان' },
  { code: '+252', country: 'SO', countryName: 'الصومال' },
  
  // Europe (أوروبا)
  { code: '+44', country: 'GB', countryName: 'المملكة المتحدة' },
  { code: '+33', country: 'FR', countryName: 'فرنسا' },
  { code: '+49', country: 'DE', countryName: 'ألمانيا' },
  { code: '+39', country: 'IT', countryName: 'إيطاليا' },
  { code: '+34', country: 'ES', countryName: 'إسبانيا' },
  { code: '+31', country: 'NL', countryName: 'هولندا' },
  { code: '+32', country: 'BE', countryName: 'بلجيكا' },
  { code: '+41', country: 'CH', countryName: 'سويسرا' },
  { code: '+43', country: 'AT', countryName: 'النمسا' },
  { code: '+46', country: 'SE', countryName: 'السويد' },
  { code: '+47', country: 'NO', countryName: 'النرويج' },
  { code: '+45', country: 'DK', countryName: 'الدنمارك' },
  { code: '+358', country: 'FI', countryName: 'فنلندا' },
  { code: '+7', country: 'RU', countryName: 'روسيا' },
  { code: '+48', country: 'PL', countryName: 'بولندا' },
  { code: '+351', country: 'PT', countryName: 'البرتغال' },
  { code: '+30', country: 'GR', countryName: 'اليونان' },
  { code: '+40', country: 'RO', countryName: 'رومانيا' },
  { code: '+36', country: 'HU', countryName: 'المجر' },
  { code: '+420', country: 'CZ', countryName: 'التشيك' },
  
  // Americas (الأمريكتان)
  { code: '+1', country: 'US', countryName: 'الولايات المتحدة/كندا' },
  { code: '+52', country: 'MX', countryName: 'المكسيك' },
  { code: '+55', country: 'BR', countryName: 'البرازيل' },
  { code: '+54', country: 'AR', countryName: 'الأرجنتين' },
  { code: '+56', country: 'CL', countryName: 'تشيلي' },
  { code: '+57', country: 'CO', countryName: 'كولومبيا' },
  { code: '+51', country: 'PE', countryName: 'بيرو' },
  { code: '+58', country: 'VE', countryName: 'فنزويلا' },
  { code: '+593', country: 'EC', countryName: 'الإكوادور' },
  
  // Asia (آسيا)
  { code: '+91', country: 'IN', countryName: 'الهند' },
  { code: '+86', country: 'CN', countryName: 'الصين' },
  { code: '+81', country: 'JP', countryName: 'اليابان' },
  { code: '+82', country: 'KR', countryName: 'كوريا الجنوبية' },
  { code: '+65', country: 'SG', countryName: 'سنغافورة' },
  { code: '+60', country: 'MY', countryName: 'ماليزيا' },
  { code: '+66', country: 'TH', countryName: 'تايلاند' },
  { code: '+84', country: 'VN', countryName: 'فيتنام' },
  { code: '+62', country: 'ID', countryName: 'إندونيسيا' },
  { code: '+63', country: 'PH', countryName: 'الفلبين' },
  { code: '+92', country: 'PK', countryName: 'باكستان' },
  { code: '+880', country: 'BD', countryName: 'بنغلاديش' },
  { code: '+94', country: 'LK', countryName: 'سريلانكا' },
  { code: '+95', country: 'MM', countryName: 'ميانمار' },
  { code: '+855', country: 'KH', countryName: 'كمبوديا' },
  { code: '+856', country: 'LA', countryName: 'لاوس' },
  
  // Africa (أفريقيا)
  { code: '+234', country: 'NG', countryName: 'نيجيريا' },
  { code: '+27', country: 'ZA', countryName: 'جنوب أفريقيا' },
  { code: '+254', country: 'KE', countryName: 'كينيا' },
  { code: '+233', country: 'GH', countryName: 'غانا' },
  { code: '+256', country: 'UG', countryName: 'أوغندا' },
  { code: '+255', country: 'TZ', countryName: 'تنزانيا' },
  { code: '+234', country: 'NG', countryName: 'نيجيريا' },
  { code: '+27', country: 'ZA', countryName: 'جنوب أفريقيا' },
  
  // Oceania (أوقيانوسيا)
  { code: '+61', country: 'AU', countryName: 'أستراليا' },
  { code: '+64', country: 'NZ', countryName: 'نيوزيلندا' },
];

export const ROLE_NAMES = {
  admin: 'مدير أساسي',
  admin2: 'مدير ثانوي',
  moderator: 'مشرف',
  user: 'مستخدم',
};

export const SAMPLE_QUEUES = [
  { id: 'queue-uuid-1', doctorName: 'د. أحمد محمد', moderatorId: 'moderator-uuid-1' },
  { id: 'queue-uuid-2', doctorName: 'د. فاطمة علي', moderatorId: 'moderator-uuid-1' },
  { id: 'queue-uuid-3', doctorName: 'د. محمود سالم', moderatorId: 'moderator-uuid-2' },
];

export const SAMPLE_MESSAGE_TEMPLATES = [
  {
    id: '1',
    title: 'رسالة الموعد',
    content: 'مرحباً {PN}، موعدك اليوم في العيادة. الموضع الحالي: {CQP}',
  },
  {
    id: '2',
    title: 'رسالة التذكير',
    content: 'تذكير: لديك موعد في العيادة خلال {ETR} دقيقة',
  },
  {
    id: '3',
    title: 'رسالة استقبال',
    content: 'أهلاً وسهلاً {PN}، يرجى الانتظار قليلاً',
  },
];
