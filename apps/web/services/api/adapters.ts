/**
 * DTO Adapters
 * Converts backend DTOs to frontend-compatible models
 */

import type { TemplateDto, ConditionDto } from './messageApiClient';
import type { QueueDto, QueuePatientDto } from './queuesApiClient';
import type { UserDto } from './usersApiClient';
import type { MessageTemplate } from '@/types/messageTemplate';
import type { MessageCondition, ConditionOperator } from '@/types/messageCondition';
import type { Queue, Patient } from '@/types';

/**
 * Convert backend TemplateDto to frontend MessageTemplate
 */
export function templateDtoToModel(dto: TemplateDto, queueId?: string): MessageTemplate {
  return {
    id: dto.id.toString(),
    queueId: queueId || dto.queueId.toString(),
    title: dto.title,
    content: dto.content,
    variables: extractVariablesFromTemplate(dto.content),
    isActive: dto.isActive ?? true,
    createdAt: new Date(dto.createdAt),
    updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined,
    createdBy: '', // Backend may not provide this; align with API response
  };
}

/**
 * Convert backend ConditionDto to frontend MessageCondition
 * Assumes conditions are listed in priority order
 */
export function conditionDtoToModel(dto: ConditionDto, index: number): MessageCondition {
  // Parse operator - map to allowed ConditionOperator values
  const operatorMap: Record<string, ConditionOperator> = {
    'EQUAL': 'EQUAL',
    'GREATER': 'GREATER',
    'LESS': 'LESS',
    'RANGE': 'RANGE',
  };
  
  const operator: ConditionOperator = operatorMap[dto.operator] || 'EQUAL';
  
  // Parse numeric values
  let value: number | undefined;
  let minValue: number | undefined;
  let maxValue: number | undefined;

  if (dto.value !== undefined && dto.value !== null) {
    const parsed = parseFloat(dto.value);
    value = !isNaN(parsed) ? parsed : undefined;
  }

  if (dto.minValue !== undefined && dto.minValue !== null) {
    const parsed = parseFloat(dto.minValue);
    minValue = !isNaN(parsed) ? parsed : undefined;
  }

  if (dto.maxValue !== undefined && dto.maxValue !== null) {
    const parsed = parseFloat(dto.maxValue);
    maxValue = !isNaN(parsed) ? parsed : undefined;
  }

  return {
    id: dto.id.toString(),
    templateId: dto.templateId.toString(),
    name: `Condition ${index + 1}`, // Fallback; backend should provide name if needed
    priority: index, // Assign priority based on order
    enabled: true, // Backend may not track this; default to true
    operator,
    value,
    minValue,
    maxValue,
    template: '', // Will be populated by caller if needed
  };
}

/**
 * Convert backend QueueDto to frontend Queue
 */
export function queueDtoToModel(dto: QueueDto): Queue {
  return {
    id: dto.id.toString(),
    doctorName: dto.doctorName,
    moderatorId: dto.createdBy.toString(), // Use createdBy as moderatorId for consistency
    isActive: dto.isActive,
  };
}

/**
 * Convert backend QueuePatientDto to frontend Patient
 */
export function patientDtoToModel(dto: QueuePatientDto): Patient {
  const statusMap: Record<string, string> = {
    waiting: 'قيد الانتظار',
    in_service: 'جاري',
    completed: 'تم',
    cancelled: 'ملغى',
  };

  return {
    id: dto.id.toString(),
    name: `${dto.firstName} ${dto.lastName}`,
    phone: dto.phoneNumber,
    countryCode: '+20', // Default; backend should provide this if available
    queueId: dto.queueId.toString(),
    position: dto.position,
    status: statusMap[dto.status] || dto.status,
    failureMetrics: { attempts: 0 },
    isPaused: false,
    messagePreview: '', // Will be populated by message resolution logic
  };
}

/**
 * Extract template variables from content string
 * Looks for patterns like {PN}, {PQP}, {ETR}, {DN}
 */
function extractVariablesFromTemplate(content: string): string[] {
  const variablePattern = /\{([A-Z]+)\}/g;
  const matches = content.match(variablePattern);
  if (!matches) return [];
  
  // Remove duplicates and the braces
  return Array.from(new Set(matches.map(m => m.slice(1, -1))));
}

/**
 * Map role strings for display
 */
export function formatUserRole(role: string): string {
  const roleMap: Record<string, string> = {
    primary_admin: 'مدير أساسي',
    secondary_admin: 'مدير ثانوي',
    moderator: 'مشرف',
    user: 'مستخدم',
  };
  return roleMap[role] || role;
}

/**
 * Build moderator display name from UserDto
 */
export function formatModeratorName(user: UserDto): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export default {
  templateDtoToModel,
  conditionDtoToModel,
  queueDtoToModel,
  patientDtoToModel,
  extractVariablesFromTemplate,
  formatUserRole,
  formatModeratorName,
};
