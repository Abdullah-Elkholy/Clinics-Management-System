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
  { code: '+20', country: 'مصر' },
  { code: '+966', country: 'السعودية' },
  { code: '+971', country: 'الإمارات' },
];

export const ROLE_NAMES = {
  admin: 'مدير أساسي',
  admin2: 'مدير ثانوي',
  moderator: 'مشرف',
  user: 'مستخدم',
};

export const SAMPLE_QUEUES = [
  { id: '1', doctorName: 'د. أحمد محمد', moderatorId: 'mod1' },
  { id: '2', doctorName: 'د. فاطمة علي', moderatorId: 'mod1' },
  { id: '3', doctorName: 'د. محمود سالم', moderatorId: 'mod2' },
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
