/**
 * Message Template Types - Per Queue
 * File: apps/web/types/messageTemplate.ts
 * 
 * Defines structure for message templates and conditions per queue
 */

export type MessageTemplateCategory = 'greeting' | 'reminder' | 'alert' | 'confirmation' | 'thank_you' | 'custom';

export interface MessageTemplate {
  id: string;                    // unique uuid
  queueId: string;               // which queue this template belongs to
  title: string;                 // template name (e.g., "Welcome Message")
  description?: string;          // optional description
  content: string;               // template text with placeholders
  variables: string[];           // list of variables in template
  isActive: boolean;             // whether template is in use
  priority?: number;             // order when multiple templates available
  
  // Metadata
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;             // user who created it
  
  // Usage stats
  usageCount?: number;           // how many times sent
  successRate?: number;          // % of successfully sent messages
}

export interface QueueTemplateConfig {
  queueId: string;
  queueName: string;
  templates: MessageTemplate[];
  defaultTemplate?: string;     // default template content
  totalConditions?: number;     // count of total conditions in this queue
}

export interface TemplateWithConditions extends MessageTemplate {
  conditionCount?: number;       // how many conditions use this template
  conditions?: any[];            // actual conditions (from messageCondition.ts)
}

// Available placeholders
export const TEMPLATE_PLACEHOLDERS = {
  PN: { label: 'Patient Name', example: 'أحمد محمد' },
  PQP: { label: 'Patient Queue Position', example: '5' },
  CQP: { label: 'Current Queue Position', example: '3' },
  ETR: { label: 'Estimated Time Remaining', example: '30 دقيقة' },
  DN: { label: 'Doctor Name', example: 'د. علي أحمد' },
  QN: { label: 'Queue Name', example: 'العيادة الخارجية' },
} as const;

export type PlaceholderKey = keyof typeof TEMPLATE_PLACEHOLDERS;
