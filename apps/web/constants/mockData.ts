/**
 * Centralized Mock Data for the application
 * This file contains all sample/mock data used across components
 * for development, testing, and UI demonstrations
 */

export const MOCK_ONGOING_SESSIONS = [
  {
    id: 'session-1',
    sessionId: 'S-001',
    clinicName: 'عيادة محمد السلام',
    doctorName: 'د. أحمد محمد',
    createdAt: '2025-01-14 10:00:00',
    totalPatients: 10,
    sentCount: 3,
    failedCount: 1,
    isPaused: false,
    patients: [
      { id: 1, name: 'أحمد محمد', phone: '01012345678', countryCode: '+20', queue: 1, status: 'تم', failedAttempts: 0, isPaused: false },
      { id: 2, name: 'فاطمة علي', phone: '01087654321', countryCode: '+20', queue: 2, status: 'جاري', failedAttempts: 0, isPaused: false },
      { id: 3, name: 'محمود حسن', phone: '01098765432', countryCode: '+20', queue: 3, status: 'فشل', failedAttempts: 2, isPaused: false },
      { id: 4, name: 'نور الدين', phone: '01011223344', countryCode: '+20', queue: 4, status: 'تم', failedAttempts: 0, isPaused: false },
      { id: 5, name: 'سارة إبراهيم', phone: '01055667788', countryCode: '+20', queue: 5, status: 'قيد الانتظار', failedAttempts: 0, isPaused: false },
    ],
  },
  {
    id: 'session-2',
    sessionId: 'S-002',
    clinicName: 'عيادة فاطمة الأنوار',
    doctorName: 'د. فاطمة علي',
    createdAt: '2025-01-14 11:30:00',
    totalPatients: 8,
    sentCount: 5,
    failedCount: 0,
    isPaused: true,
    patients: [
      { id: 6, name: 'علي حسن', phone: '01098765432', countryCode: '+20', queue: 1, status: 'تم', failedAttempts: 0, isPaused: true },
      { id: 7, name: 'ليلى محمد', phone: '01055667788', countryCode: '+20', queue: 2, status: 'تم', failedAttempts: 0, isPaused: true },
    ],
  },
];

export const MOCK_FAILED_SESSIONS = [
  {
    id: 'failed-session-1',
    sessionId: 'F-001',
    clinicName: 'عيادة خالد الطيب',
    doctorName: 'د. خالد الطيب',
    createdAt: '2025-01-14 09:00:00',
    failedAt: '2025-01-14 09:15:30',
    totalPatients: 12,
    failedCount: 3,
    retryCount: 1,
    patients: [
      {
        id: 101,
        name: 'محمود إبراهيم',
        phone: '01012345678',
        countryCode: '+20',
        queue: 1,
        status: 'فشل',
        failedReason: 'فشل الاتصال بالخادم',
        retryCount: 1,
      },
      {
        id: 102,
        name: 'نور علي',
        phone: '01087654321',
        countryCode: '+20',
        queue: 2,
        status: 'فشل',
        failedReason: 'رقم جوال غير صحيح',
        retryCount: 2,
      },
      {
        id: 103,
        name: 'سارة محمد',
        phone: '01098765432',
        countryCode: '+20',
        queue: 3,
        status: 'فشل',
        failedReason: 'انقطاع الإنترنت',
        retryCount: 0,
      },
    ],
  },
  {
    id: 'failed-session-2',
    sessionId: 'F-002',
    clinicName: 'عيادة زيدان الخليج',
    doctorName: 'د. زيدان الخليج',
    createdAt: '2025-01-14 13:00:00',
    failedAt: '2025-01-14 13:45:00',
    totalPatients: 7,
    failedCount: 1,
    retryCount: 0,
    patients: [
      {
        id: 104,
        name: 'فيصل أحمد',
        phone: '01011223344',
        countryCode: '+20',
        queue: 1,
        status: 'فشل',
        failedReason: 'حد التأخير تم تجاوزه',
        retryCount: 1,
      },
    ],
  },
];

export const MOCK_COMPLETED_SESSIONS = [
  {
    id: 'completed-session-1',
    sessionId: 'C-001',
    clinicName: 'عيادة سارة إبراهيم',
    doctorName: 'د. سارة إبراهيم',
    createdAt: '2025-01-14 08:00:00',
    completedAt: '2025-01-14 09:30:50',
    totalPatients: 5,
    sentCount: 5,
    patients: [
      { id: 4, name: 'علي حسن', phone: '01055667788', countryCode: '+20', queue: 1, status: 'تم', completedAt: '2025-01-14 09:15:33' },
      { id: 5, name: 'ليلى محمد', phone: '01011223344', countryCode: '+20', queue: 2, status: 'تم', completedAt: '2025-01-14 09:28:47' },
    ],
  },
  {
    id: 'completed-session-2',
    sessionId: 'C-002',
    clinicName: 'عيادة محمود السلام',
    doctorName: 'د. محمود السلام',
    createdAt: '2025-01-14 10:30:00',
    completedAt: '2025-01-14 11:45:20',
    totalPatients: 8,
    sentCount: 8,
    patients: [
      { id: 201, name: 'خديجة علي', phone: '01098765432', countryCode: '+20', queue: 1, status: 'تم', completedAt: '2025-01-14 11:20:15' },
      { id: 202, name: 'زيدان حسن', phone: '01012345678', countryCode: '+20', queue: 2, status: 'تم', completedAt: '2025-01-14 11:35:42' },
    ],
  },
];

export const MOCK_QUEUE_PATIENTS = [
  { id: 1, name: 'أحمد محمد', phone: '01012345678', countryCode: '+20', queue: 3 },
  { id: 2, name: 'فاطمة علي', phone: '01087654321', countryCode: '+20', queue: 5 },
  { id: 3, name: 'محمود حسن', phone: '01098765432', countryCode: '+20', queue: 2 },
  { id: 4, name: 'نور الدين', phone: '01011223344', countryCode: '+20', queue: 7 },
  { id: 5, name: 'سارة إبراهيم', phone: '01055667788', countryCode: '+20', queue: 1 },
];

export const MOCK_QUEUES = [
  { id: '1', doctorName: 'د. أحمد محمد', moderatorId: 'mod1' },
  { id: '2', doctorName: 'د. فاطمة علي', moderatorId: 'mod1' },
  { id: '3', doctorName: 'د. محمود سالم', moderatorId: 'mod2' },
];

export const MOCK_MESSAGE_TEMPLATES = [
  {
    id: '1',
    title: 'رسالة الموعد',
    content: 'مرحباً {PN}، موعدك اليوم في العيادة. الموضع الحالي: {CQP}',
    description: 'رسالة ترحيب وتأكيد الموعد مع إظهار الموضع الحالي',
    category: 'appointment',
    queueId: '1',
    isActive: true,
  },
  {
    id: '2',
    title: 'رسالة التذكير',
    content: 'تذكير: لديك موعد في العيادة خلال {ETR} دقيقة',
    description: 'تذكير بوقت الموعد المتبقي',
    category: 'reminder',
    queueId: '1',
    isActive: true,
  },
  {
    id: '3',
    title: 'رسالة استقبال',
    content: 'أهلاً وسهلاً {PN}، يرجى الانتظار قليلاً. ترتيبك: {PQP}',
    description: 'رسالة استقبال بسيطة مع ترتيب الانتظار',
    category: 'greeting',
    queueId: '1',
    isActive: true,
  },
  {
    id: '4',
    title: 'رسالة الأولوية العالية',
    content: 'السلام عليكم {PN}، أنت القادم للكشف مباشرة. يرجى التوجه للعيادة الآن.',
    description: 'رسالة مخصصة للمرضى ذوي الأولوية العالية',
    category: 'priority',
    queueId: '1',
    isActive: true,
  },
  {
    id: '5',
    title: 'رسالة تأجيل الموعد',
    content: 'نأسف {PN}، العيادة مغلقة حالياً. سيتم إعادة جدولة موعدك قريباً.',
    description: 'رسالة توضيح تأجيل الموعد',
    category: 'postpone',
    queueId: '1',
    isActive: false,
  },
  {
    id: '6',
    title: 'رسالة شكر وتقييم',
    content: 'شكراً لك {PN} على زيارتك. يرجى تقييم خدمتنا من خلال الرابط: [رابط التقييم]',
    description: 'رسالة شكر مع طلب التقييم',
    category: 'feedback',
    queueId: '1',
    isActive: true,
  },
];

export const MOCK_QUEUE_MESSAGE_CONDITIONS = [
  {
    id: '1',
    name: 'مرضى العيادة الرئيسية',
    priority: 1,
    enabled: true,
    operator: 'EQUAL' as const,
    value: 1,
    template: '1',
  },
  {
    id: '2',
    name: 'ترتيب متقدم',
    priority: 2,
    enabled: true,
    operator: 'LESS' as const,
    value: 3,
    template: '4',
  },
  {
    id: '3',
    name: 'انتظار طويل',
    priority: 3,
    enabled: true,
    operator: 'RANGE' as const,
    minValue: 10,
    maxValue: 20,
    template: '2',
  },
];
