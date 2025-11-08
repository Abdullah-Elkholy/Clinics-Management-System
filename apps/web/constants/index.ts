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
  { code: '+20', country: 'مصر', countryName: 'مصر'},
  { code: '+966', country: 'السعودية', countryName: 'السعودية'},
  { code: '+971', country: 'الإمارات', countryName: 'الإمارات'},
  { code: '+968', country: 'عمان', countryName: 'عمان'},
  { code: '+965', country: 'الكويت', countryName: 'الكويت'},
  { code: '+974', country: 'قطر', countryName: 'قطر'},
  { code: '+973', country: 'البحرين', countryName: 'البحرين'},
  { code: '+212', country: 'المغرب', countryName: 'المغرب'},
  { code: '+216', country: 'تونس', countryName: 'تونس'},
  { code: '+213', country: 'الجزائر', countryName: 'الجزائر'},
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
