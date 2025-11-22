// User Types - Import from centralized roles definition
export { UserRole, Feature, ActionType } from './roles';
export type { } from './roles';
// Re-export canonical types from dedicated files
export type { MessageTemplate } from './messageTemplate';
export type { MessageCondition } from './messageCondition';
export type { User, ModeratorUser, RegularUser, AdminUser, CreateUserPayload, UpdateUserPayload, UpdateQuotaPayload, UserFilter, UserStats, ModeratorQuota } from './user';

import type { MessageTemplate } from './messageTemplate';
import type { MessageCondition } from './messageCondition';
import type { User } from './user';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface Patient {
  id: string;                  // GUID (UUID format)
  queueId: string;             // GUID: foreign key to Queue
  name: string;                // Patient full name
  phone: string;               // E.164 format with country code
  countryCode?: string;
  isValidWhatsAppNumber?: boolean | null; // null = not checked, true = valid, false = invalid
  position?: number;
  status?: string;             // 'pending' | 'active' | 'completed' | 'failed'
  failedReason?: string;
  // Consolidated failure tracking (replacing retryCount and failedAttempts)
  failureMetrics?: {
    attempts: number;        // Total send attempts (1=initial, 2+=retries). Backend Message.Attempts
    lastFailedAt?: string;   // Timestamp of last failure
    reason?: string;         // Failure reason
  };
  isPaused?: boolean;
  completedAt?: string;
  messagePreview?: string;
  selected?: boolean;
  // Soft-delete fields (30-day trash window)
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: number;
}

export interface Queue {
  id: string;                  // GUID (UUID format)
  doctorName: string;
  moderatorId: string;         // GUID: references moderator user ID
  isActive?: boolean;
  currentPosition?: number;    // Current position pointer (CQP)
  estimatedWaitMinutes?: number; // Estimated time per session (ETS)
  // Soft-delete fields (30-day trash window)
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: number;
}

export interface OngoingTask {
  id: string;
  sessionId: string;
  patientName: string;
  phone: string;
  messageStatus: 'pending' | 'sent' | 'failed';
  timestamp: string;
}

export interface FailedTask {
  id: string;
  patientName: string;
  phone: string;
  failureReason: string;
  attemptTime: string;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  debugData?: Record<string, any>; // Optional raw error/debug info for development
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface QueueState {
  queues: Queue[];
  selectedQueueId: string | null;
  patients: Patient[];
  currentPosition: number;
  estimatedTimePerSession: number;
}

export interface MessageState {
  templates: MessageTemplate[];
  selectedTemplateId: string;
  conditions: MessageCondition[];
}
