/**
 * Role-Based UI Visibility Constants
 * 
 * Defines which UI elements, sections, and features are visible to each role.
 * Update this as requirements change.
 */

import { UserRole } from '@/types/roles';

/**
 * Navigation menu items visibility by role
 */
export const NAVIGATION_VISIBILITY: Record<UserRole, string[]> = {
  [UserRole.PrimaryAdmin]: [
    'dashboard',
    'users',
    'moderators',
    'queues',
    'templates',
    'messages',
    'settings',
    'analytics',
    'reports',
  ],
  [UserRole.SecondaryAdmin]: [
    'dashboard',
    'moderators',
    'queues',
    'templates',
    'messages',
    'analytics',
  ],
  [UserRole.Moderator]: [
    'dashboard',
    'queues',
    'templates',
    'messages',
    'patients',
  ],
  [UserRole.User]: [
    'dashboard',
    'queues',
    'messages',
  ],
};

/**
 * Panel visibility by role (Admin Panels)
 */
export const PANEL_VISIBILITY: Record<UserRole, string[]> = {
  [UserRole.PrimaryAdmin]: [
    'user-management',
    'moderator-management',
    'quota-management',
    'system-settings',
    'audit-logs',
  ],
  [UserRole.SecondaryAdmin]: [
    'moderator-management',
    'quota-management',
    'system-settings',
  ],
  [UserRole.Moderator]: [
    'user-management',
    'quota-display',
  ],
  [UserRole.User]: [],
};

/**
 * Button visibility by role
 */
export const BUTTON_VISIBILITY: Record<string, UserRole[]> = {
  'create-user': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator],
  'create-moderator': [UserRole.PrimaryAdmin],
  'create-queue': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator],
  'delete-user': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator],
  'delete-moderator': [UserRole.PrimaryAdmin],
  'delete-queue': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator],
  'edit-quota': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin],
  'view-analytics': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin],
  'send-messages': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator, UserRole.User],
  'manage-templates': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator],
  'manage-conditions': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator],
};

/**
 * Field visibility by role (Form fields, editable fields)
 */
export const FIELD_VISIBILITY: Record<string, UserRole[]> = {
  'user-quota': [UserRole.PrimaryAdmin],
  'moderator-quota': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin],
  'user-role': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin],
  'system-settings': [UserRole.PrimaryAdmin],
  'audit-trail': [UserRole.PrimaryAdmin],
};

/**
 * Feature access by role
 */
export const FEATURE_ACCESS: Record<string, UserRole[]> = {
  'bulk-operations': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator],
  'export-data': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin],
  'view-reports': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin],
  'manage-quotas': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin],
  'whatsapp-integration': [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator],
};

/**
 * Get visible items for a specific role
 */
export function getVisibleItems(
  role: UserRole | undefined,
  visibility: Record<UserRole, string[]>
): string[] {
  return role ? visibility[role] ?? [] : [];
}

/**
 * Check if item is visible for role
 */
export function isItemVisible(
  itemId: string,
  role: UserRole | undefined,
  visibility: Record<UserRole, string[]>
): boolean {
  if (!role) return false;
  const visibleItems = visibility[role] ?? [];
  return visibleItems.includes(itemId);
}

/**
 * Check if button is visible for role
 */
export function isButtonVisible(buttonId: string, role: UserRole | undefined): boolean {
  if (!role) return false;
  const allowedRoles = BUTTON_VISIBILITY[buttonId] ?? [];
  return allowedRoles.includes(role);
}

/**
 * Check if field is visible for role
 */
export function isFieldVisible(fieldId: string, role: UserRole | undefined): boolean {
  if (!role) return false;
  const allowedRoles = FIELD_VISIBILITY[fieldId] ?? [];
  return allowedRoles.includes(role);
}

/**
 * Check if feature is accessible for role
 */
export function isFeatureAccessible(featureId: string, role: UserRole | undefined): boolean {
  if (!role) return false;
  const allowedRoles = FEATURE_ACCESS[featureId] ?? [];
  return allowedRoles.includes(role);
}

/**
 * Get list of allowed buttons for role
 */
export function getAllowedButtons(role: UserRole | undefined): string[] {
  if (!role) return [];
  return Object.entries(BUTTON_VISIBILITY)
    .filter(([_, roles]) => roles.includes(role))
    .map(([buttonId, _]) => buttonId);
}

/**
 * Get list of allowed features for role
 */
export function getAllowedFeatures(role: UserRole | undefined): string[] {
  if (!role) return [];
  return Object.entries(FEATURE_ACCESS)
    .filter(([_, roles]) => roles.includes(role))
    .map(([featureId, _]) => featureId);
}
