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
    condition: dto.condition ? conditionDtoToModel(dto.condition) : undefined,
    createdAt: new Date(dto.createdAt),
    updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined,
    createdBy: '', // Backend may not provide this; align with API response
  };
}

/**
 * Convert backend ConditionDto to frontend MessageCondition
 * Assumes conditions are listed in priority order
 */
export function conditionDtoToModel(dto: ConditionDto, index?: number): MessageCondition {
  const operatorMap: Record<string, ConditionOperator> = {
    UNCONDITIONED: 'UNCONDITIONED',
    DEFAULT: 'DEFAULT',
    EQUAL: 'EQUAL',
    GREATER: 'GREATER',
    LESS: 'LESS',
    RANGE: 'RANGE',
  };

  const operator: ConditionOperator = operatorMap[dto.operator] || 'EQUAL';

  return {
    id: dto.id.toString(),
    queueId: dto.queueId.toString(),
    templateId: dto.templateId !== undefined && dto.templateId !== null ? dto.templateId.toString() : undefined,
    name: `Condition ${(index ?? 0) + 1}`,
    priority: index ?? 0,
    enabled: true,
    operator,
    value: dto.value ?? undefined,
    minValue: dto.minValue ?? undefined,
    maxValue: dto.maxValue ?? undefined,
    template: '',
    createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
    updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined,
  };
}

/**
 * Convert backend QueueDto to frontend Queue
 */
export function queueDtoToModel(dto: QueueDto): Queue {
  return {
    id: dto.id.toString(),
    doctorName: dto.doctorName,
    // Prefer explicit moderatorId from API; fall back to createdBy if missing for backward compatibility
    moderatorId: (dto as any).moderatorId !== undefined && (dto as any).moderatorId !== null
      ? (dto as any).moderatorId.toString()
      : dto.createdBy.toString(),
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
