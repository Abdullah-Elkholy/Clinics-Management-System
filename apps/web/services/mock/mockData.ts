/**
 * Mock Data Fixtures
 *
 * Provides realistic sample templates and conditions for development and testing.
 * Used when NEXT_PUBLIC_USE_MOCK_DATA=true or as fallback on backend failures.
 * All templates use Arabic naming to match production data expectations.
 */

import type { TemplateDto, ConditionDto } from '../api/messageApiClient';

/**
 * Mock templates indexed by queue ID.
 * Provides realistic examples of appointment reminders, follow-ups, and notifications.
 */
export const mockTemplatesByQueueId: Record<string, TemplateDto[]> = {
  '1': [
    {
      id: 101,
      title: 'تذكير موعد زيارة',
      content: 'مرحبا {{name}}، نذكرك بموعد زيارتك يوم {{date}} الساعة {{time}}. برجاء تأكيد حضورك.',
      queueId: 1,
      isActive: true,
      createdAt: '2025-01-01T10:00:00Z',
      updatedAt: '2025-01-01T10:00:00Z',
    },
    {
      id: 102,
      title: 'رسالة متابعة بعد الزيارة',
      content: 'شكراً لزيارتك {{name}}. نتمنى أن تكون قد استفدت. لا تتردد في التواصل معنا في حالة الحاجة.',
      queueId: 1,
      isActive: true,
      createdAt: '2025-01-02T10:00:00Z',
      updatedAt: '2025-01-02T10:00:00Z',
    },
    {
      id: 103,
      title: 'طلب تحديد موعد جديد',
      content: 'السلام عليكم {{name}}، هل تود تحديد موعد جديد؟ يمكنك حجز موعدك عبر التطبيق.',
      queueId: 1,
      isActive: false,
      createdAt: '2025-01-03T10:00:00Z',
      updatedAt: '2025-01-03T10:00:00Z',
    },
  ],
  '2': [
    {
      id: 201,
      title: 'تنبيه الدفع المستحق',
      content: 'السلام عليكم {{name}}، هناك فاتورة مستحقة الدفع. قيمتها {{amount}} ريال. برجاء التسديد في أقرب وقت.',
      queueId: 2,
      isActive: true,
      createdAt: '2025-01-01T11:00:00Z',
      updatedAt: '2025-01-01T11:00:00Z',
    },
    {
      id: 202,
      title: 'تذكير المتابعة الطبية',
      content: 'مرحبا {{name}}، حان موعد متابعتك الطبية. التاريخ: {{date}}. برجاء التأكيد.',
      queueId: 2,
      isActive: true,
      createdAt: '2025-01-02T11:00:00Z',
      updatedAt: '2025-01-02T11:00:00Z',
    },
  ],
  '3': [
    {
      id: 301,
      title: 'رسالة ترحيبية لمريض جديد',
      content: 'أهلاً وسهلاً {{name}} في عيادتنا. نتطلع لخدمتك بأفضل شكل. يمكنك التواصل معنا للاستفسارات.',
      queueId: 3,
      isActive: true,
      createdAt: '2025-01-01T12:00:00Z',
      updatedAt: '2025-01-01T12:00:00Z',
    },
  ],
};

/**
 * Mock conditions indexed by queue ID.
 * Provides examples of message triggering rules (e.g., age range, appointment type).
 */
export const mockConditionsByQueueId: Record<string, ConditionDto[]> = {
  '1': [
    {
      id: 1001,
      templateId: 101,
      operator: 'age_between',
      minValue: '18',
      maxValue: '65',
      createdAt: '2025-01-01T10:30:00Z',
    },
    {
      id: 1002,
      templateId: 101,
      operator: 'appointment_type',
      value: 'follow_up',
      createdAt: '2025-01-01T10:30:00Z',
    },
    {
      id: 1003,
      templateId: 102,
      operator: 'days_since_visit',
      minValue: '1',
      maxValue: '7',
      createdAt: '2025-01-02T10:30:00Z',
    },
  ],
  '2': [
    {
      id: 2001,
      templateId: 201,
      operator: 'invoice_overdue',
      minValue: '30',
      createdAt: '2025-01-01T11:30:00Z',
    },
    {
      id: 2002,
      templateId: 202,
      operator: 'age_between',
      minValue: '45',
      maxValue: '100',
      createdAt: '2025-01-02T11:30:00Z',
    },
  ],
  '3': [
    {
      id: 3001,
      templateId: 301,
      operator: 'is_new_patient',
      value: 'true',
      createdAt: '2025-01-01T12:30:00Z',
    },
  ],
};

/**
 * Returns mock templates for a given queue ID.
 * If queueId not found, returns empty array (simulating no templates created yet).
 */
export const getMockTemplates = (queueId: number): TemplateDto[] => {
  return mockTemplatesByQueueId[String(queueId)] ?? [];
};

/**
 * Returns mock conditions for a given queue ID.
 * If queueId not found, returns empty array (simulating no conditions set).
 */
export const getMockConditions = (queueId: number): ConditionDto[] => {
  return mockConditionsByQueueId[String(queueId)] ?? [];
};

/**
 * Creates a new mock template with a generated ID.
 * Useful for simulating template creation in mock mode.
 */
export const createMockTemplate = (
  queueId: number,
  title: string,
  content: string,
  isActive: boolean = true
): TemplateDto => {
  const timestamp = new Date().toISOString();
  return {
    id: Math.floor(Math.random() * 10000) + 100,
    title,
    content,
    queueId,
    isActive,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

/**
 * Creates a new mock condition with a generated ID.
 * Useful for simulating condition creation in mock mode.
 */
export const createMockCondition = (
  templateId: number,
  operator: string,
  value?: string,
  minValue?: string,
  maxValue?: string
): ConditionDto => {
  return {
    id: Math.floor(Math.random() * 10000) + 1000,
    templateId,
    operator,
    value,
    minValue,
    maxValue,
    createdAt: new Date().toISOString(),
  };
};
