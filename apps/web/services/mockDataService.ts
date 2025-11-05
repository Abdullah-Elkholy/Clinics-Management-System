/**
 * Mock Data Service
 * Provides complete mock data for all entities matching backend DTOs
 * Used for frontend development before backend integration
 */

// Helper function to generate session IDs
const generateSessionId = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = now.getFullYear();
  const sequence = String(Math.floor(Math.random() * 999)).padStart(3, '0');
  return `SES-${day}-${month}-${sequence}`;
};

// Types matching backend DTOs
export interface User {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: 'primary_admin' | 'secondary_admin' | 'moderator' | 'user';
  moderatorId?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Moderator extends User {
  role: 'moderator';
  moderatorId: undefined;
}

export interface ModeratorSettings {
  id: number;
  moderatorUserId: number;
  whatsAppPhoneNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Queue {
  id: number;
  doctorName: string;
  description?: string;
  createdBy: number;
  moderatorId: number;
  currentPosition: number;
  estimatedWaitMinutes?: number;
  isActive: boolean;
  createdAt: Date;
}

export interface MessageTemplate {
  id: number;
  title: string;
  content: string;
  createdBy: number;
  moderatorId: number;
  isShared: boolean;
  isActive: boolean;
  createdAt: Date;
  category?: string;
  tags?: string[];
  variables?: string[];
}

export interface Message {
  id: number;
  patientId?: number;
  templateId?: number;
  queueId?: number;
  senderUserId?: number;
  moderatorId: number;
  providerMessageId?: string;
  channel: 'whatsapp' | 'sms' | 'email';
  recipientPhone: string;
  content: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'read';
  attempts: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  createdAt: Date;
}

export interface Quota {
  id: number;
  moderatorUserId: number;
  messagesQuota: number;
  consumedMessages: number;
  queuesQuota: number;
  consumedQueues: number;
  remainingMessages: number;
  remainingQueues: number;
  updatedAt: Date;
  isMessagesQuotaLow: boolean;
  isQueuesQuotaLow: boolean;
}

export interface Patient {
  id: number;
  queueId: number;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  position: number;
  status: 'waiting' | 'in_service' | 'completed' | 'cancelled';
  createdAt: Date;
}

export interface MessageSession {
  id: string;
  queueId: number;
  userId: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  totalMessages: number;
  sentMessages: number;
  startTime: Date;
  endTime?: Date;
  lastUpdated?: Date;
}

export interface WhatsAppSession {
  id: number;
  moderatorUserId: number;
  sessionName?: string;
  providerSessionId?: string;
  status?: 'connected' | 'disconnected' | 'pending';
  lastSyncAt?: Date;
  createdAt: Date;
}

/**
 * Mock Users - Including primary admin, secondary admins, moderators, and users
 */
export const MOCK_USERS: User[] = [
  {
    id: 1,
    username: 'admin',
    firstName: 'محمد',
    lastName: 'الإدارة',
    role: 'primary_admin',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 2,
    username: 'ahmed_mod',
    firstName: 'أحمد',
    lastName: 'علي',
    role: 'moderator',
    isActive: true,
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05'),
  },
  {
    id: 3,
    username: 'sara_mod',
    firstName: 'سارة',
    lastName: 'محمد',
    role: 'moderator',
    isActive: true,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: 4,
    username: 'khalid_mod',
    firstName: 'خالد',
    lastName: 'إبراهيم',
    role: 'moderator',
    isActive: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  // Users under Ahmed (moderator id 2)
  {
    id: 5,
    username: 'user_ahmed1',
    firstName: 'فاطمة',
    lastName: 'أحمد',
    role: 'user',
    moderatorId: 2,
    isActive: true,
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: 6,
    username: 'user_ahmed2',
    firstName: 'علي',
    lastName: 'محمود',
    role: 'user',
    moderatorId: 2,
    isActive: true,
    createdAt: new Date('2024-01-21'),
    updatedAt: new Date('2024-01-21'),
  },
  // Users under Sara (moderator id 3)
  {
    id: 7,
    username: 'user_sara1',
    firstName: 'ليلى',
    lastName: 'أحمد',
    role: 'user',
    moderatorId: 3,
    isActive: true,
    createdAt: new Date('2024-01-25'),
    updatedAt: new Date('2024-01-25'),
  },
  {
    id: 8,
    username: 'user_sara2',
    firstName: 'مريم',
    lastName: 'علي',
    role: 'user',
    moderatorId: 3,
    isActive: true,
    createdAt: new Date('2024-01-26'),
    updatedAt: new Date('2024-01-26'),
  },
  {
    id: 9,
    username: 'user_sara3',
    firstName: 'نور',
    lastName: 'الهدى',
    role: 'user',
    moderatorId: 3,
    isActive: true,
    createdAt: new Date('2024-01-27'),
    updatedAt: new Date('2024-01-27'),
  },
  // Users under Khalid (moderator id 4)
  {
    id: 10,
    username: 'user_khalid1',
    firstName: 'محمد',
    lastName: 'خالد',
    role: 'user',
    moderatorId: 4,
    isActive: true,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
];

/**
 * Mock Moderator Settings
 */
export const MOCK_MODERATOR_SETTINGS: ModeratorSettings[] = [
  {
    id: 1,
    moderatorUserId: 2,
    whatsAppPhoneNumber: '+966501234568',
    isActive: true,
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05'),
  },
  {
    id: 2,
    moderatorUserId: 3,
    whatsAppPhoneNumber: '+966501234569',
    isActive: true,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: 3,
    moderatorUserId: 4,
    whatsAppPhoneNumber: '+966501234570',
    isActive: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
];

/**
 * Mock Quotas
 */
export const MOCK_QUOTAS: Quota[] = [
  {
    id: 1,
    moderatorUserId: 2,
    messagesQuota: 1000,
    consumedMessages: 340,
    queuesQuota: 10,
    consumedQueues: 3,
    remainingMessages: 660,
    remainingQueues: 7,
    updatedAt: new Date(),
    isMessagesQuotaLow: false,
    isQueuesQuotaLow: false,
  },
  {
    id: 2,
    moderatorUserId: 3,
    messagesQuota: 800,
    consumedMessages: 720,
    queuesQuota: 8,
    consumedQueues: 6,
    remainingMessages: 80,
    remainingQueues: 2,
    updatedAt: new Date(),
    isMessagesQuotaLow: true,
    isQueuesQuotaLow: true,
  },
  {
    id: 3,
    moderatorUserId: 4,
    messagesQuota: 1500,
    consumedMessages: 450,
    queuesQuota: 15,
    consumedQueues: 5,
    remainingMessages: 1050,
    remainingQueues: 10,
    updatedAt: new Date(),
    isMessagesQuotaLow: false,
    isQueuesQuotaLow: false,
  },
];

/**
 * Mock Queues - Moderator scoped
 */
export const MOCK_QUEUES: Queue[] = [
  // Ahmed's queues (moderator id 2)
  {
    id: 1,
    doctorName: 'د. أحمد علي - عيادة',
    description: 'عيادة الأسنان الرئيسية',
    createdBy: 2,
    moderatorId: 2,
    currentPosition: 5,
    estimatedWaitMinutes: 15,
    isActive: true,
    createdAt: new Date('2024-02-01'),
  },
  {
    id: 2,
    doctorName: 'د. أحمد علي - الطوارئ',
    description: 'عيادة الطوارئ',
    createdBy: 2,
    moderatorId: 2,
    currentPosition: 12,
    estimatedWaitMinutes: 45,
    isActive: true,
    createdAt: new Date('2024-02-01'),
  },
  {
    id: 3,
    doctorName: 'د. أحمد علي - الفحص',
    description: 'عيادة الفحص العام',
    createdBy: 5,
    moderatorId: 2,
    currentPosition: 3,
    estimatedWaitMinutes: 10,
    isActive: true,
    createdAt: new Date('2024-02-02'),
  },
  // Sara's queues (moderator id 3)
  {
    id: 4,
    doctorName: 'د. سارة محمد - عيادة',
    description: 'عيادة الباطنية',
    createdBy: 3,
    moderatorId: 3,
    currentPosition: 8,
    estimatedWaitMinutes: 25,
    isActive: true,
    createdAt: new Date('2024-02-03'),
  },
  {
    id: 5,
    doctorName: 'د. سارة محمد - المتابعة',
    description: 'عيادة المتابعة',
    createdBy: 7,
    moderatorId: 3,
    currentPosition: 2,
    estimatedWaitMinutes: 8,
    isActive: true,
    createdAt: new Date('2024-02-04'),
  },
  // Khalid's queues (moderator id 4)
  {
    id: 6,
    doctorName: 'د. خالد إبراهيم - عيادة',
    description: 'عيادة الجراحة',
    createdBy: 4,
    moderatorId: 4,
    currentPosition: 6,
    estimatedWaitMinutes: 30,
    isActive: true,
    createdAt: new Date('2024-02-05'),
  },
];

/**
 * Mock Message Templates - Moderator scoped
 */
export const MOCK_MESSAGE_TEMPLATES: MessageTemplate[] = [
  // Ahmed's templates (moderator id 2)
  {
    id: 1,
    title: 'تأكيد الموعد',
    content: 'السلام عليكم، تم تأكيد موعدك مع د. أحمد علي يوم {{date}} الساعة {{time}}. يرجى الحضور قبل 15 دقيقة.',
    createdBy: 2,
    moderatorId: 2,
    isShared: true,
    isActive: true,
    category: 'appointment',
    tags: ['appointment', 'confirmation'],
    variables: ['date', 'time'],
    createdAt: new Date('2024-02-10'),
  },
  {
    id: 2,
    title: 'تذكير بالموعد',
    content: 'تذكير: موعدك غداً الساعة {{time}} مع د. أحمد علي. للإلغاء أو التأجيل يرجى الرد على هذه الرسالة.',
    createdBy: 2,
    moderatorId: 2,
    isShared: true,
    isActive: true,
    category: 'reminder',
    tags: ['reminder', 'appointment'],
    variables: ['time'],
    createdAt: new Date('2024-02-11'),
  },
  {
    id: 3,
    title: 'رسالة الترحيب',
    content: 'مرحباً بك {{name}} في عيادة د. أحمد علي. نتطلع لخدمتك بأفضل جودة.',
    createdBy: 2,
    moderatorId: 2,
    isShared: true,
    isActive: true,
    category: 'greeting',
    tags: ['greeting', 'welcome'],
    variables: ['name'],
    createdAt: new Date('2024-02-12'),
  },
  // Sara's templates (moderator id 3)
  {
    id: 4,
    title: 'نتيجة الفحص',
    content: 'تم الانتهاء من فحصك {{name}}. سيتم تقديم النتائج لك في {{date}}.',
    createdBy: 3,
    moderatorId: 3,
    isShared: true,
    isActive: true,
    category: 'results',
    tags: ['results', 'test'],
    variables: ['name', 'date'],
    createdAt: new Date('2024-02-13'),
  },
  {
    id: 5,
    title: 'طلب البيانات الطبية',
    content: 'يرجى تقديم سجلك الطبي السابق عند القدوم للموعد. هذا مهم جداً.',
    createdBy: 3,
    moderatorId: 3,
    isShared: true,
    isActive: true,
    category: 'request',
    tags: ['medical', 'records'],
    variables: [],
    createdAt: new Date('2024-02-14'),
  },
  // Khalid's templates (moderator id 4)
  {
    id: 6,
    title: 'تعليمات ما بعد العملية',
    content: 'يرجى اتباع هذه التعليمات بعد العملية {{date}}: 1. الراحة لمدة 48 ساعة 2. عدم تحريك المنطقة المصابة.',
    createdBy: 4,
    moderatorId: 4,
    isShared: true,
    isActive: true,
    category: 'instructions',
    tags: ['surgery', 'postop'],
    variables: ['date'],
    createdAt: new Date('2024-02-15'),
  },
];

/**
 * Mock Messages
 */
export const MOCK_MESSAGES: Message[] = [
  {
    id: 1,
    patientId: 1,
    templateId: 1,
    queueId: 1,
    senderUserId: 2,
    moderatorId: 2,
    channel: 'whatsapp',
    recipientPhone: '+966501234601',
    content: 'السلام عليكم، تم تأكيد موعدك مع د. أحمد علي يوم 2024-03-15 الساعة 10:00. يرجى الحضور قبل 15 دقيقة.',
    status: 'sent',
    attempts: 1,
    sentAt: new Date('2024-02-16T10:30:00'),
    createdAt: new Date('2024-02-16T10:29:00'),
  },
  {
    id: 2,
    patientId: 2,
    templateId: 1,
    queueId: 1,
    senderUserId: 2,
    moderatorId: 2,
    channel: 'whatsapp',
    recipientPhone: '+966501234602',
    content: 'السلام عليكم، تم تأكيد موعدك مع د. أحمد علي يوم 2024-03-16 الساعة 11:00. يرجى الحضور قبل 15 دقيقة.',
    status: 'delivered',
    attempts: 1,
    sentAt: new Date('2024-02-16T11:00:00'),
    createdAt: new Date('2024-02-16T10:59:00'),
  },
  {
    id: 3,
    patientId: 3,
    templateId: 4,
    queueId: 4,
    senderUserId: 3,
    moderatorId: 3,
    channel: 'whatsapp',
    recipientPhone: '+966501234603',
    content: 'تم الانتهاء من فحصك أحمد. سيتم تقديم النتائج لك في 2024-02-20.',
    status: 'sent',
    attempts: 1,
    sentAt: new Date('2024-02-17T14:00:00'),
    createdAt: new Date('2024-02-17T13:59:00'),
  },
  {
    id: 4,
    patientId: 4,
    templateId: 6,
    queueId: 6,
    senderUserId: 4,
    moderatorId: 4,
    channel: 'whatsapp',
    recipientPhone: '+966501234604',
    content: 'يرجى اتباع هذه التعليمات بعد العملية 2024-02-18: 1. الراحة لمدة 48 ساعة 2. عدم تحريك المنطقة المصابة.',
    status: 'failed',
    attempts: 2,
    lastAttemptAt: new Date('2024-02-18T09:15:00'),
    createdAt: new Date('2024-02-18T09:10:00'),
  },
];

/**
 * Mock Patients
 */
export const MOCK_PATIENTS: Patient[] = [
  {
    id: 1,
    queueId: 1,
    firstName: 'محمود',
    lastName: 'أحمد',
    phoneNumber: '+966501234601',
    position: 1,
    status: 'in_service',
    createdAt: new Date('2024-02-16T09:00:00'),
  },
  {
    id: 2,
    queueId: 1,
    firstName: 'هناء',
    lastName: 'علي',
    phoneNumber: '+966501234602',
    position: 2,
    status: 'waiting',
    createdAt: new Date('2024-02-16T09:15:00'),
  },
  {
    id: 3,
    queueId: 2,
    firstName: 'سارة',
    lastName: 'محمد',
    phoneNumber: '+966501234603',
    position: 1,
    status: 'waiting',
    createdAt: new Date('2024-02-16T08:30:00'),
  },
  {
    id: 4,
    queueId: 4,
    firstName: 'خديجة',
    lastName: 'أحمد',
    phoneNumber: '+966501234604',
    position: 1,
    status: 'completed',
    createdAt: new Date('2024-02-17T10:00:00'),
  },
];

/**
 * Mock WhatsApp Sessions
 */
export const MOCK_WHATSAPP_SESSIONS: WhatsAppSession[] = [
  {
    id: 1,
    moderatorUserId: 2,
    sessionName: 'Ahmed Session',
    status: 'connected',
    lastSyncAt: new Date('2024-02-16T15:30:00'),
    createdAt: new Date('2024-01-05'),
  },
  {
    id: 2,
    moderatorUserId: 3,
    sessionName: 'Sara Session',
    status: 'connected',
    lastSyncAt: new Date('2024-02-16T15:25:00'),
    createdAt: new Date('2024-01-10'),
  },
  {
    id: 3,
    moderatorUserId: 4,
    sessionName: 'Khalid Session',
    status: 'pending',
    lastSyncAt: new Date('2024-02-15T10:00:00'),
    createdAt: new Date('2024-01-15'),
  },
];

/**
 * Mock Message Sessions
 */
export const MOCK_MESSAGE_SESSIONS: MessageSession[] = [
  {
    id: generateSessionId(),
    queueId: 1,
    userId: 2,
    status: 'active',
    totalMessages: 50,
    sentMessages: 25,
    startTime: new Date('2024-02-16T09:00:00'),
    lastUpdated: new Date('2024-02-16T15:30:00'),
  },
  {
    id: generateSessionId(),
    queueId: 2,
    userId: 3,
    status: 'completed',
    totalMessages: 30,
    sentMessages: 30,
    startTime: new Date('2024-02-15T08:00:00'),
    endTime: new Date('2024-02-15T14:30:00'),
    lastUpdated: new Date('2024-02-15T14:30:00'),
  },
  {
    id: generateSessionId(),
    queueId: 4,
    userId: 7,
    status: 'active',
    totalMessages: 45,
    sentMessages: 18,
    startTime: new Date('2024-02-16T10:00:00'),
    lastUpdated: new Date('2024-02-16T15:00:00'),
  },
];

/**
 * Helper functions for mock data management
 */

/**
 * Get moderator by ID
 */
export const getModerator = (moderatorId: number): Moderator | undefined => {
  return MOCK_USERS.find(
    (u) => u.id === moderatorId && u.role === 'moderator'
  ) as Moderator | undefined;
};

/**
 * Get all moderators
 */
export const getAllModerators = (): Moderator[] => {
  return MOCK_USERS.filter((u) => u.role === 'moderator') as Moderator[];
};

/**
 * Get users under a moderator
 */
export const getUsersUnderModerator = (moderatorId: number): User[] => {
  return MOCK_USERS.filter((u) => u.moderatorId === moderatorId);
};

/**
 * Get queues for a moderator
 */
export const getModeratorQueues = (moderatorId: number): Queue[] => {
  return MOCK_QUEUES.filter((q) => q.moderatorId === moderatorId);
};

/**
 * Get message templates for a moderator
 */
export const getModeratorTemplates = (moderatorId: number): MessageTemplate[] => {
  return MOCK_MESSAGE_TEMPLATES.filter((t) => t.moderatorId === moderatorId);
};

/**
 * Get messages for a moderator
 */
export const getModeratorMessages = (moderatorId: number): Message[] => {
  return MOCK_MESSAGES.filter((m) => m.moderatorId === moderatorId);
};

/**
 * Get quota for a moderator
 */
export const getModeratorQuota = (moderatorId: number): Quota | undefined => {
  return MOCK_QUOTAS.find((q) => q.moderatorUserId === moderatorId);
};

/**
 * Get settings for a moderator
 */
export const getModeratorSettings = (moderatorId: number): ModeratorSettings | undefined => {
  return MOCK_MODERATOR_SETTINGS.find((s) => s.moderatorUserId === moderatorId);
};

/**
 * Get WhatsApp session for a moderator
 */
export const getModeratorWhatsAppSession = (moderatorId: number): WhatsAppSession | undefined => {
  return MOCK_WHATSAPP_SESSIONS.find((s) => s.moderatorUserId === moderatorId);
};

/**
 * Get system statistics
 */
export const getSystemStats = () => {
  return {
    totalModerators: getAllModerators().length,
    totalUsers: MOCK_USERS.filter((u) => u.role === 'user').length,
    totalQueues: MOCK_QUEUES.length,
    totalTemplates: MOCK_MESSAGE_TEMPLATES.length,
    totalMessages: MOCK_MESSAGES.length,
    totalQuotaUsage: {
      messages: MOCK_QUOTAS.reduce((sum, q) => sum + q.consumedMessages, 0),
      queues: MOCK_QUOTAS.reduce((sum, q) => sum + q.consumedQueues, 0),
    },
    activeWhatsAppSessions: MOCK_WHATSAPP_SESSIONS.filter((s) => s.status === 'connected').length,
    messageDeliveryRate: (() => {
      const delivered = MOCK_MESSAGES.filter((m) => m.status === 'delivered' || m.status === 'read').length;
      return MOCK_MESSAGES.length > 0 ? Math.round((delivered / MOCK_MESSAGES.length) * 100) : 0;
    })(),
  };
};

export default {
  MOCK_USERS,
  MOCK_MODERATOR_SETTINGS,
  MOCK_QUOTAS,
  MOCK_QUEUES,
  MOCK_MESSAGE_TEMPLATES,
  MOCK_MESSAGES,
  MOCK_PATIENTS,
  MOCK_WHATSAPP_SESSIONS,
  MOCK_MESSAGE_SESSIONS,
  getModerator,
  getAllModerators,
  getUsersUnderModerator,
  getModeratorQueues,
  getModeratorTemplates,
  getModeratorMessages,
  getModeratorQuota,
  getModeratorSettings,
  getModeratorWhatsAppSession,
  getSystemStats,
};
