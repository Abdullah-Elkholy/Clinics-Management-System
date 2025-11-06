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
  id: number;
  name: string;
  phone: string;
  countryCode?: string;
  queue?: number;
  position?: number;
  status?: string;
  failedReason?: string;
  // Consolidated failure tracking (replacing retryCount and failedAttempts)
  failureMetrics?: {
    attempts: number;        // Total failed attempts
    retries: number;         // Total retry attempts
    lastFailedAt?: string;   // Timestamp of last failure
    reason?: string;         // Failure reason
  };
  isPaused?: boolean;
  completedAt?: string;
  messagePreview?: string;
  queueName?: string;
  selected?: boolean;
}

export interface Queue {
  id: string;
  doctorName: string;
  moderatorId?: string;
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
