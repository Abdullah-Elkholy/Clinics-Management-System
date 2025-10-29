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
  // Queue 1 - Default message (with default condition)
  {
    id: '1',
    title: 'رسالة الموعد',
    content: 'مرحباً {PN}، موعدك اليوم في العيادة. الموضع الحالي: {CQP}',
    description: 'رسالة ترحيب وتأكيد الموعد مع إظهار الموضع الحالي',
    queueId: '1',
    moderatorId: 'mod1',
    conditionId: 'DEFAULT_Q1', // Default condition for Queue 1
    isActive: true,
    variables: [],
    createdBy: 'أحمد محمد',
    createdAt: new Date('2025-10-15T10:30:00Z'),
    updatedAt: new Date('2025-10-20T14:45:00Z'),
  },
  // Queue 1 - Conditional message 1
  {
    id: '2',
    title: 'رسالة التذكير',
    content: 'تذكير: لديك موعد في العيادة خلال {ETR} دقيقة',
    description: 'تذكير بوقت الموعد المتبقي',
    queueId: '1',
    moderatorId: 'mod1',
    conditionId: '1', // Condition: wait time > 5 minutes
    isActive: true,
    variables: [],
    createdBy: 'فاطمة علي',
    createdAt: new Date('2025-10-16T09:15:00Z'),
    updatedAt: new Date('2025-10-22T11:20:00Z'),
  },
  // Queue 1 - Conditional message 2
  {
    id: '3',
    title: 'رسالة استقبال',
    content: 'أهلاً وسهلاً {PN}، يرجى الانتظار قليلاً. ترتيبك: {PQP}',
    description: 'رسالة استقبال بسيطة مع ترتيب الانتظار',
    queueId: '1',
    moderatorId: 'mod1',
    conditionId: '2', // Condition: queue position < 3
    isActive: true,
    variables: [],
    createdBy: 'سارة حسن',
    createdAt: new Date('2025-10-17T13:45:00Z'),
    updatedAt: new Date('2025-10-21T15:30:00Z'),
  },
  // Queue 1 - Conditional message 3
  {
    id: '4',
    title: 'رسالة الأولوية العالية',
    content: 'السلام عليكم {PN}، أنت القادم للكشف مباشرة. يرجى التوجه للعيادة الآن.',
    description: 'رسالة مخصصة للمرضى ذوي الأولوية العالية',
    queueId: '1',
    moderatorId: 'mod1',
    conditionId: '3', // Condition: priority = HIGH
    isActive: true,
    variables: [],
    createdBy: 'محمود خالد',
    createdAt: new Date('2025-10-18T11:00:00Z'),
    updatedAt: new Date('2025-10-23T09:50:00Z'),
  },
  // Queue 1 - Inactive template
  {
    id: '5',
    title: 'رسالة تأجيل الموعد',
    content: 'نأسف {PN}، العيادة مغلقة حالياً. سيتم إعادة جدولة موعدك قريباً.',
    description: 'رسالة توضيح تأجيل الموعد',
    queueId: '1',
    moderatorId: 'mod1',
    conditionId: null, // No condition for inactive template
    isActive: false,
    variables: [],
    createdBy: 'أحمد محمد',
    createdAt: new Date('2025-10-14T08:30:00Z'),
    updatedAt: new Date('2025-10-19T10:15:00Z'),
  },
  // Queue 1 - Feedback template
  {
    id: '6',
    title: 'رسالة شكر وتقييم',
    content: 'شكراً لك {PN} على زيارتك. يرجى تقييم خدمتنا من خلال الرابط: [رابط التقييم]',
    description: 'رسالة شكر مع طلب التقييم',
    queueId: '1',
    moderatorId: 'mod1',
    conditionId: null, // Optional condition
    isActive: true,
    variables: [],
    createdBy: 'سارة حسن',
    createdAt: new Date('2025-10-19T14:20:00Z'),
    updatedAt: new Date('2025-10-22T16:00:00Z'),
  },
  // Queue 2 - Default message (with default condition)
  {
    id: '7',
    title: 'رسالة الموعد - العيادة 2',
    content: 'مرحباً {PN}، موعدك عند د. فاطمة علي. الموضع الحالي: {CQP}',
    description: 'رسالة ترحيب وتأكيد الموعد',
    queueId: '2',
    moderatorId: 'mod1',
    conditionId: 'DEFAULT_Q2', // Default condition for Queue 2
    isActive: true,
    variables: [],
    createdBy: 'فاطمة علي',
    createdAt: new Date('2025-10-20T10:00:00Z'),
    updatedAt: new Date('2025-10-20T10:00:00Z'),
  },
  // Queue 3 - Default message (with default condition)
  {
    id: '8',
    title: 'رسالة الموعد - العيادة 3',
    content: 'مرحباً {PN}، موعدك عند د. محمود سالم. الموضع الحالي: {CQP}',
    description: 'رسالة ترحيب وتأكيد الموعد',
    queueId: '3',
    moderatorId: 'mod2',
    conditionId: 'DEFAULT_Q3', // Default condition for Queue 3
    isActive: true,
    variables: [],
    createdBy: 'محمود خالد',
    createdAt: new Date('2025-10-21T12:30:00Z'),
    updatedAt: new Date('2025-10-21T12:30:00Z'),
  },
];

export const MOCK_QUEUE_MESSAGE_CONDITIONS = [
  // Default condition for Queue 1
  {
    id: 'DEFAULT_Q1',
    name: 'القالب الافتراضي',
    priority: 0,
    enabled: true,
    operator: 'EQUAL' as const,
    value: 0,
    minValue: undefined,
    maxValue: undefined,
    template: '1',
    queueId: '1',
    moderatorId: 'mod1',
    description: 'القالب الافتراضي لقائمة الانتظار 1 - يستخدم عند عدم توفر شروط أخرى',
  },
  // Default condition for Queue 2
  {
    id: 'DEFAULT_Q2',
    name: 'القالب الافتراضي',
    priority: 0,
    enabled: true,
    operator: 'EQUAL' as const,
    value: 0,
    minValue: undefined,
    maxValue: undefined,
    template: '7',
    queueId: '2',
    moderatorId: 'mod1',
    description: 'القالب الافتراضي لقائمة الانتظار 2 - يستخدم عند عدم توفر شروط أخرى',
  },
  // Default condition for Queue 3
  {
    id: 'DEFAULT_Q3',
    name: 'القالب الافتراضي',
    priority: 0,
    enabled: true,
    operator: 'EQUAL' as const,
    value: 0,
    minValue: undefined,
    maxValue: undefined,
    template: '8',
    queueId: '3',
    moderatorId: 'mod2',
    description: 'القالب الافتراضي لقائمة الانتظار 3 - يستخدم عند عدم توفر شروط أخرى',
  },
  // Condition 1: Applied to template 2 (رسالة التذكير)
  {
    id: '1',
    name: 'مرضى العيادة الرئيسية',
    priority: 1,
    enabled: true,
    operator: 'GREATER' as const,
    value: 5,
    minValue: undefined,
    maxValue: undefined,
    template: '2',
    queueId: '1',
    moderatorId: 'mod1',
    description: 'تطبيق على رسالة التذكير عندما ينتظر المريض أكثر من 5 دقائق',
  },
  // Condition 2: Applied to template 3 (رسالة استقبال)
  {
    id: '2',
    name: 'ترتيب متقدم',
    priority: 2,
    enabled: true,
    operator: 'LESS' as const,
    value: 3,
    minValue: undefined,
    maxValue: undefined,
    template: '3',
    queueId: '1',
    moderatorId: 'mod1',
    description: 'تطبيق على رسالة الاستقبال عندما يكون ترتيب المريض أقل من 3',
  },
  // Condition 3: Applied to template 4 (رسالة الأولوية)
  {
    id: '3',
    name: 'حالة أولوية عالية',
    priority: 3,
    enabled: true,
    operator: 'EQUAL' as const,
    value: 1,
    minValue: undefined,
    maxValue: undefined,
    template: '4',
    queueId: '1',
    moderatorId: 'mod1',
    description: 'تطبيق على رسالة الأولوية عندما تكون أولوية المريض = 1 (عالية)',
  },
];

/**
 * Mock Quota Data
 * Contains quota information for message and queue management
 */
export const MOCK_QUOTA = {
  messagesQuota: {
    total: 1000,
    consumed: 450,
    remaining: 550,
    percentUsed: 45,
  },
  queuesQuota: {
    total: 10,
    consumed: 3,
    remaining: 7,
    percentUsed: 30,
  },
  lastUpdated: new Date(),
};
