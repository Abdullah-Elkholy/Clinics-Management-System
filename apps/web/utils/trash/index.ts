/**
 * Trash & Archive System - Public API Export
 * File: apps/web/utils/trash/index.ts
 * 
 * Central export point for all trash and archive related utilities
 */

// Utilities
export {
  RestoreErrorType,
  type RestoreError,
  parseRestoreError,
  getRestoreErrorMessage,
  getDaysRemainingInTrash,
  isRestorable,
  formatDeletionDate,
  calculatePaginationState,
  type PaginationState,
} from '@/utils/trashUtils';

// Components
export { TrashCountdownBadge } from '@/components/TrashCountdownBadge';
export { TrashTab } from '@/components/TrashTab';

// Management Views
export { default as QueuesManagementView } from '@/components/Queue/QueuesManagementView';
export { default as TemplatesManagementView } from '@/components/Queue/TemplatesManagementView';
export { default as PatientsManagementView } from '@/components/Queue/PatientsManagementView';
export { default as UsersManagementView } from '@/components/Moderators/UsersManagementView';
