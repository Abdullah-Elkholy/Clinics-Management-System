// User Types
// NOTE: Use the UserRole enum from @/types/roles (apps/web/types/roles.ts) as the source of truth
// This type is kept for backward compatibility but should not be used in new code
export type UserRole = 'primary_admin' | 'secondary_admin' | 'moderator' | 'user';

export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName?: string;
  role: UserRole;
  moderatorId?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface Patient {
  id: string;
  position: number;
  name: string;
  phone: string;
  countryCode: string;
  selected?: boolean;
}

export interface Queue {
  id: string;
  doctorName: string;
  moderatorId?: string;
}

export interface MessageTemplate {
  id: string;
  title: string;
  content: string;
}

export interface MessageCondition {
  id: string;
  type: 'range' | 'lessThan' | 'greaterThan';
  minValue?: number;
  maxValue?: number;
  templateId: string;
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
