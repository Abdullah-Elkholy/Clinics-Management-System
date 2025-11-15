/**
 * Message Template Types - Per Queue
 * File: apps/web/types/messageTemplate.ts
 * 
 * Defines structure for message templates and conditions per queue
 */

export interface MessageTemplate {
  id: string;                  // GUID (UUID format)
  queueId: string;             // GUID: which queue this template belongs to
  title: string;               // template name (e.g., "Welcome Message")
  content: string;             // template text with placeholders
  variables: string[];         // list of variables in template
  condition?: MessageCondition; // associated condition (determines template role: DEFAULT/UNCONDITIONED/active)
  priority?: number;           // order when multiple templates available
  
  // Metadata
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;           // GUID: user ID who created it
  
  // Usage stats
  usageCount?: number;         // how many times sent
  successRate?: number;        // % of successfully sent messages
  
  // Soft-delete fields (30-day trash window)
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: number;
}

import { MessageCondition } from './messageCondition';

export interface QueueTemplateConfig {
  queueId: string;
  queueName: string;
  templates: MessageTemplate[];
  defaultTemplate?: string;     // default template content
  totalConditions?: number;     // count of total conditions in this queue
}

export interface TemplateWithConditions extends MessageTemplate {
  conditionCount?: number;       // how many conditions use this template
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
