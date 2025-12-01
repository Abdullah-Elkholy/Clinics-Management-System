/**
 * Frontend Types - Matching Backend DTOs
 * All interfaces for moderator hierarchy system
 * 
 * UNIFIED TYPE HIERARCHY:
 * - Core User types and ModeratorQuota are defined in types/user.ts
 * - UserRole is defined in types/roles.ts
 * - This file extends with moderator-specific and domain types
 * - Imports unified types to ensure single source of truth
 */

import type { ModeratorQuota } from './user';
import type { UserRole } from './roles';

// Re-export ModeratorQuota for convenience (single source of truth)
export type { ModeratorQuota };
export type { UserRole };

// Additional status and enum types
export type MessageStatus = 'queued' | 'sending' | 'sent' | 'failed';
export type PatientStatus = 'waiting' | 'in_service' | 'completed' | 'cancelled';
export type WhatsAppStatus = 'connected' | 'disconnected' | 'pending';
export type MessageSessionStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type MessageChannel = 'whatsapp' | 'sms' | 'email';

// Legacy/Deprecated: Use user.ts types instead
// These kept for backward compatibility but should be migrated to types/user.ts
export interface UserBase {
  id: number;
  username: string;
  firstName: string;
  lastName?: string;
  email: string;
  phoneNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUser extends UserBase {
  role: 'primary_admin' | 'secondary_admin';
}

export interface ModeratorUser extends UserBase {
  role: 'moderator';
  moderatorId: undefined;
}

export type Moderator = ModeratorUser;

export interface RegularUser extends UserBase {
  role: 'user';
  moderatorId: number;
}

export type User = AdminUser | ModeratorUser | RegularUser;

// Moderator-specific extended types
export interface ModeratorDetails extends ModeratorUser {
  managedUsersCount: number;
  queuesCount: number;
  templatesCount: number;
  quota: ModeratorQuota;         // Use unified ModeratorQuota from user.ts
  settings: ModeratorSettings;
  whatsappSession: WhatsAppSession | null;
  lastActivityAt?: Date;
}

export interface ModeratorSettings {
  id: number;
  moderatorUserId: number;
  whatsAppPhoneNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Queue Types
export interface Queue {
  id: number;
  doctorName: string;
  createdBy: number;
  moderatorId: number;
  currentPosition: number;
  estimatedWaitMinutes?: number;
  isActive: boolean;
  createdAt: Date;
}

export interface QueueWithModerator extends Queue {
  moderator: ModeratorUser;
}

// Message Template Types
// DEPRECATED: Use types/messageTemplate.ts for the source-of-truth MessageTemplate interface.
// This interface is retained for moderator-related responses but should not be used in new code.
// Instead import MessageTemplate from @/types/messageTemplate
export interface MessageTemplate {
  id: string;
  queueId?: string;
  title: string;
  content: string;
  createdBy?: string;
  moderatorId?: number;
  isShared?: boolean;
  isActive: boolean;
  condition?: { operator?: string }; // Operator determines template role (DEFAULT/UNCONDITIONED/active)
  category?: string;
  tags?: string[];
  variables?: string[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface MessageTemplateWithModerator extends MessageTemplate {
  moderator: ModeratorUser;
}

// Message Types
export interface Message {
  id: string; // Changed from number to string (Guid)
  patientId?: number;
  templateId?: number;
  queueId?: number;
  senderUserId?: number;
  moderatorId: number;
  providerMessageId?: string;
  channel: string; // WhatsApp session name
  countryCode: string;
  patientPhone: string;
  position: number; // Patient's queue position at creation time
  calculatedPosition: number; // Offset from CQP (Patient.Position - Queue.CurrentPosition)
  fullName: string; // Patient's full name at creation time
  content: string;
  status: MessageStatus;
  errorMessage?: string;
  attempts: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  createdBy?: number; // User who created this message
  updatedBy?: number; // User who last updated this message
}

export interface MessageWithDetails extends Message {
  moderator: ModeratorUser;
  template?: MessageTemplate;
  queue?: Queue;
  senderUser?: User;
}

// Patient Types
export interface Patient {
  id: number;
  queueId: number;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  position: number;
  status: PatientStatus;
  createdAt: Date;
}

export interface PatientWithQueue extends Patient {
  queue: Queue;
}

// WhatsApp Session Types
export interface WhatsAppSession {
  id: number;
  moderatorUserId: number;
  sessionName?: string;
  providerSessionId?: string;
  status?: WhatsAppStatus;
  lastSyncAt?: Date;
  createdAt: Date;
}

// Message Session Types
export interface MessageSession {
  id: string;
  queueId: number;
  moderatorId: number;
  userId: number;
  status: MessageSessionStatus;
  totalMessages: number;
  sentMessages: number;
  failedMessages: number; // Number of failed messages in this session
  ongoingMessages: number; // Number of ongoing (queued/sending) messages
  startTime: Date;
  endTime?: Date;
  lastUpdated?: Date;
  isPaused?: boolean;
  pausedAt?: Date;
  pausedBy?: number;
  pauseReason?: string;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: number;
  progressPercent?: number;
}

export interface MessageSessionWithDetails extends MessageSession {
  queue: Queue;
  user: User;
}

// System Types
export interface SystemStats {
  totalModerators: number;
  totalUsers: number;
  totalQueues: number;
  totalTemplates: number;
  totalMessages: number;
  totalQuotaUsage: {
    messages: number;
    queues: number;
  };
  activeWhatsAppSessions: number;
  messageDeliveryRate: number;
}

// Form Request Types
export interface CreateModeratorRequest {
  firstName: string;
  lastName: string;
  username: string;
  messagesQuota: number;
  queuesQuota: number;
}

export interface UpdateModeratorRequest {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface AddUserToModeratorRequest {
  firstName: string;
  lastName: string;
  username: string;
}

export interface CreateQueueRequest {
  doctorName: string;
  estimatedWaitMinutes?: number;
  moderatorId: number;
  currentPosition?: number;
}

export interface UpdateQueueRequest {
  doctorName?: string;
  estimatedWaitMinutes?: number;
  currentPosition?: number;
}

export interface CreateMessageTemplateRequest {
  title: string;
  content: string;
  isShared: boolean;
  category?: string;
  tags?: string[];
  variables?: string[];
}

export interface UpdateMessageTemplateRequest {
  title?: string;
  content?: string;
  isShared?: boolean;
  isActive?: boolean;
  category?: string;
  tags?: string[];
  variables?: string[];
}

export interface CreateMessageRequest {
  patientPhone: string;
  content: string;
  channel: MessageChannel;
  templateId?: number;
  queueId?: number;
  patientId?: number;
}

export interface UpdateQuotaRequest {
  messagesQuota: number;
  queuesQuota: number;
}

// Service Response Types
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Filter Types
export interface UserFilter {
  role?: UserRole;
  moderatorId?: number;
  isActive?: boolean;
  searchTerm?: string;
}

export interface QueueFilter {
  moderatorId?: number;
  isActive?: boolean;
  searchTerm?: string;
}

export interface MessageTemplateFilter {
  moderatorId?: number;
  isActive?: boolean;
  category?: string;
  tags?: string[];
  searchTerm?: string;
}

export interface MessageFilter {
  moderatorId?: number;
  status?: MessageStatus;
  channel?: MessageChannel;
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
}

// Event Types
export interface ModeratorEvent {
  type: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated';
  moderatorId: number;
  timestamp: Date;
  data?: any;
}

export interface QuotaEvent {
  type: 'updated' | 'exceeded' | 'warning';
  moderatorId: number;
  messageUsage: { used: number; quota: number };
  queueUsage: { used: number; quota: number };
  timestamp: Date;
}

export interface MessageEvent {
  type: 'sent' | 'failed';
  messageId: string; // Changed from number to string (Guid)
  status: MessageStatus;
  moderatorId: number;
  timestamp: Date;
}

// Constants
export const USER_ROLES = ['primary_admin', 'secondary_admin', 'moderator', 'user'] as const;
export const MESSAGE_STATUSES = ['queued', 'sending', 'sent', 'failed'] as const;
export const PATIENT_STATUSES = ['waiting', 'in_service', 'completed', 'cancelled'] as const;
export const MESSAGE_CHANNELS = ['whatsapp', 'sms', 'email'] as const;
export const WHATSAPP_STATUSES = ['connected', 'disconnected', 'pending'] as const;
export const MESSAGE_SESSION_STATUSES = ['active', 'paused', 'completed', 'cancelled'] as const;

// Utility functions for type guards
export const isAdminUser = (user: User): user is AdminUser => {
  return user.role === 'primary_admin' || user.role === 'secondary_admin';
};

export const isModeratorUser = (user: User): user is ModeratorUser => {
  return user.role === 'moderator';
};

export const isRegularUser = (user: User): user is RegularUser => {
  return user.role === 'user';
};

export default {
  USER_ROLES,
  MESSAGE_STATUSES,
  PATIENT_STATUSES,
  WHATSAPP_STATUSES,
  MESSAGE_SESSION_STATUSES,
  MESSAGE_CHANNELS,
  isAdminUser,
  isModeratorUser,
  isRegularUser,
};
