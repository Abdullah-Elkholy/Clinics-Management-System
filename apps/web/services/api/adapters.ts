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
import { parseAsUtc } from '@/utils/dateTimeUtils';

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
    condition: dto.condition ? conditionDtoToModel(dto.condition) : undefined,
    createdAt: parseAsUtc(dto.createdAt) || new Date(),
    updatedAt: dto.updatedAt ? parseAsUtc(dto.updatedAt) : undefined,
    createdBy: dto.createdBy?.toString() || '', // Use real CreatedBy from backend
    updatedBy: dto.updatedBy?.toString() || '', // User who last updated it
    isDeleted: dto.isDeleted ?? false, // Single source of truth: active = !isDeleted
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
    createdAt: dto.createdAt ? parseAsUtc(dto.createdAt) : undefined,
    updatedAt: dto.updatedAt ? parseAsUtc(dto.updatedAt) : undefined,
  };
}

/**
 * Convert backend QueueDto to frontend Queue
 */
export function queueDtoToModel(dto: QueueDto): Queue {
  const dtoExtended = dto as QueueDto & { moderatorId?: number };
  return {
    id: dto.id.toString(),
    doctorName: dto.doctorName,
    // Prefer explicit moderatorId from API; fall back to createdBy if missing for backward compatibility
    moderatorId: dtoExtended.moderatorId !== undefined && dtoExtended.moderatorId !== null
      ? dtoExtended.moderatorId.toString()
      : dto.createdBy.toString(),
    isActive: dto.isActive,
    currentPosition: dto.currentPosition,
    estimatedWaitMinutes: dto.estimatedWaitMinutes,
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
    countryCode: dto.countryCode || '+20', // Use real countryCode from backend, fallback to default
    isValidWhatsAppNumber: dto.isValidWhatsAppNumber,
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
