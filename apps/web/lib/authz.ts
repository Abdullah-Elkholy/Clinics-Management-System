/**
 * Authorization Utilities - Pure functions for permission checking
 * SOLID: Single Responsibility - Only handles permission logic
 * SOLID: Dependency Inversion - Functions accept role as parameter
 */

import { UserRole, Feature, ROLE_PERMISSIONS, ROLE_METADATA, PANEL_ACCESS } from '@/types/roles';

/**
 * Check if a specific role has a specific feature permission
 * Pure function - no side effects, always gives same result for same input
 */
export const canAccess = (userRole: UserRole | undefined | null, feature: Feature): boolean => {
  if (!userRole || !ROLE_PERMISSIONS[userRole]) {
    return false;
  }
  return ROLE_PERMISSIONS[userRole].has(feature);
};

/**
 * Check if a role can access a panel
 * Used to show/hide entire sections of the UI
 */
export const canAccessPanel = (userRole: UserRole | undefined | null, panelName: string): boolean => {
  if (!userRole) {
    return false;
  }
  const allowedRoles = PANEL_ACCESS[panelName];
  return allowedRoles ? allowedRoles.includes(userRole) : false;
};

/**
 * Get all features a role can access
 * Useful for generating capability lists
 */
export const getFeaturesByRole = (userRole: UserRole): Feature[] => {
  const features = ROLE_PERMISSIONS[userRole];
  return features ? Array.from(features) : [];
};

/**
 * Check if role has ANY of the provided features
 * Useful for optional/alternative features
 */
export const canAccessAny = (userRole: UserRole | undefined | null, features: Feature[]): boolean => {
  return features.some(feature => canAccess(userRole, feature));
};

/**
 * Check if role has ALL of the provided features
 * Useful for complex operations requiring multiple permissions
 */
export const canAccessAll = (userRole: UserRole | undefined | null, features: Feature[]): boolean => {
  return features.every(feature => canAccess(userRole, feature));
};

/**
 * Get role display information
 * Used throughout the UI for role badges, descriptions, etc.
 */
export const getRoleDisplayName = (role: UserRole | undefined | null): string => {
  if (!role || !ROLE_METADATA[role]) {
    return 'مستخدم';
  }
  return ROLE_METADATA[role].displayName;
};

export const getRoleDescription = (role: UserRole | undefined | null): string => {
  if (!role || !ROLE_METADATA[role]) {
    return 'دور غير معروف';
  }
  return ROLE_METADATA[role].description;
};

export const getRoleColor = (role: UserRole | undefined | null): string => {
  if (!role || !ROLE_METADATA[role]) {
    return 'gray';
  }
  return ROLE_METADATA[role].color;
};

export const getRoleIcon = (role: UserRole | undefined | null): string => {
  if (!role || !ROLE_METADATA[role]) {
    return 'user';
  }
  return ROLE_METADATA[role].icon;
};

/**
 * Check if user is admin (primary or secondary)
 * Convenient for common role checks
 */
export const isAdmin = (role: UserRole | undefined | null): boolean => {
  return role === UserRole.PrimaryAdmin || role === UserRole.SecondaryAdmin;
};

/**
 * Check if user is primary admin
 */
export const isPrimaryAdmin = (role: UserRole | undefined | null): boolean => {
  return role === UserRole.PrimaryAdmin;
};

/**
 * Check if user is moderator or above
 */
export const isModerator = (role: UserRole | undefined | null): boolean => {
  return role === UserRole.Moderator || isAdmin(role);
};

/**
 * Get role hierarchy level (higher number = more permissions)
 * Useful for comparisons
 */
export const getRoleLevel = (role: UserRole | undefined | null): number => {
  if (!role) return -1;
  switch (role) {
    case UserRole.PrimaryAdmin:
      return 4;
    case UserRole.SecondaryAdmin:
      return 3;
    case UserRole.Moderator:
      return 2;
    case UserRole.User:
      return 1;
    default:
      return 0;
  }
};

/**
 * Check if one role can manage another role
 * Hierarchy: PrimaryAdmin > SecondaryAdmin > Moderator > User
 */
export const canManageRole = (managerRole: UserRole | undefined | null, targetRole: UserRole): boolean => {
  if (!managerRole) {
    return false;
  }
  const managerLevel = getRoleLevel(managerRole);
  const targetLevel = getRoleLevel(targetRole);
  return managerLevel > targetLevel;
};

/**
 * Type guard to ensure we have a valid user role
 */
export const isValidRole = (role: unknown): role is UserRole => {
  return Object.values(UserRole).includes(role as UserRole);
};
