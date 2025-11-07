/**
 * Authorization Hooks - React hooks for permission checking in components
 * SOLID: Single Responsibility - Each hook has one clear purpose
 * SOLID: Dependency Inversion - Hooks depend on auth context, not concrete implementations
 */

'use client';

import { useAuth } from '@/contexts/AuthContext';
import { UserRole, Feature, PANEL_ACCESS } from '@/types/roles';
import {
  canAccess,
  canAccessPanel,
  canAccessAny,
  canAccessAll,
  isAdmin,
  isPrimaryAdmin,
  isModerator,
  getRoleLevel,
  canManageRole,
} from '@/lib/authz';
import { useCallback, useMemo } from 'react';

/**
 * Hook: Check if current user can access a specific feature
 * Usage: const canEdit = useCanAccess(Feature.EDIT_MESSAGE_TEMPLATE);
 */
export const useCanAccess = (feature: Feature): boolean => {
  const { user } = useAuth();
  return useMemo(() => canAccess(user?.role as UserRole | undefined, feature), [user?.role, feature]);
};

/**
 * Hook: Check if current user can access a panel
 * Usage: const canAccessMessages = useCanAccessPanel('messages');
 */
export const useCanAccessPanel = (panelName: string): boolean => {
  const { user } = useAuth();
  return useMemo(() => canAccessPanel(user?.role as UserRole | undefined, panelName), [user?.role, panelName]);
};

/**
 * Hook: Check if current user can access ANY of multiple features
 * Usage: const canEdit = useCanAccessAny([Feature.EDIT_TEMPLATE, Feature.EDIT_CONDITION]);
 */
export const useCanAccessAny = (features: Feature[]): boolean => {
  const { user } = useAuth();
  return useMemo(() => canAccessAny(user?.role as UserRole | undefined, features), [user?.role, features]);
};

/**
 * Hook: Check if current user can access ALL of multiple features
 * Usage: const canManage = useCanAccessAll([Feature.DELETE_TEMPLATE, Feature.EDIT_TEMPLATE]);
 */
export const useCanAccessAll = (features: Feature[]): boolean => {
  const { user } = useAuth();
  return useMemo(() => canAccessAll(user?.role as UserRole | undefined, features), [user?.role, features]);
};

/**
 * Hook: Get the current user's role
 * Usage: const role = useUserRole();
 */
export const useUserRole = (): UserRole | undefined => {
  const { user } = useAuth();
  return useMemo(() => user?.role as UserRole | undefined, [user?.role]);
};

/**
 * Hook: Check if current user is admin
 * Usage: const isAdmin = useIsAdmin();
 */
export const useIsAdmin = (): boolean => {
  const { user } = useAuth();
  return useMemo(() => isAdmin(user?.role as UserRole | undefined), [user?.role]);
};

/**
 * Hook: Check if current user is primary admin
 * Usage: const isPrimary = useIsPrimaryAdmin();
 */
export const useIsPrimaryAdmin = (): boolean => {
  const { user } = useAuth();
  return useMemo(() => isPrimaryAdmin(user?.role as UserRole | undefined), [user?.role]);
};

/**
 * Hook: Check if current user is moderator or above
 * Usage: const isMod = useIsModerator();
 */
export const useIsModerator = (): boolean => {
  const { user } = useAuth();
  return useMemo(() => isModerator(user?.role as UserRole | undefined), [user?.role]);
};

/**
 * Hook: Get list of features current user can access
 * Usage: const features = useAccessibleFeatures();
 */
export const useAccessibleFeatures = (): Feature[] => {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user?.role) {
      return [];
    }
    return Array.from(require('@/types/roles').ROLE_PERMISSIONS[user.role] || []);
  }, [user?.role]);
};

/**
 * Hook: Get list of panels current user can access
 * Usage: const panels = useAccessiblePanels();
 */
export const useAccessiblePanels = (): string[] => {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user?.role) {
      return [];
    }
    return Object.entries(PANEL_ACCESS)
      .filter(([_, roles]) => roles.includes(user.role as UserRole))
      .map(([panelName]) => panelName);
  }, [user?.role]);
};

/**
 * Hook: Require a feature - throws or returns false if user lacks permission
 * Usage: 
 *   - With required=true (default): throws error if no access (fails fast)
 *   - With required=false: returns boolean for conditional rendering
 */
export const useRequireAccess = (feature: Feature, options: { required?: boolean } = {}): boolean => {
  const { required = true } = options;
  const { user } = useAuth();

  const hasAccess = useMemo(() => canAccess(user?.role as UserRole | undefined, feature), [user?.role, feature]);

  if (required && !hasAccess) {
    throw new Error(`User lacks required permission: ${feature}`);
  }

  return hasAccess;
};

/**
 * Hook: Get callback to check permission on demand
 * Usage: const checkAccess = useCheckAccess(); ... if (checkAccess(Feature.DELETE_USER)) { ... }
 */
export const useCheckAccess = (): ((feature: Feature) => boolean) => {
  const { user } = useAuth();
  return useCallback((feature: Feature) => canAccess(user?.role as UserRole | undefined, feature), [user?.role]);
};

/**
 * Hook: Get callback to check if can manage a specific role
 * Usage: const canManage = useCanManageRole(); ... if (canManage(UserRole.Moderator)) { ... }
 */
export const useCanManageRole = (): ((targetRole: UserRole) => boolean) => {
  const { user } = useAuth();
  return useCallback((targetRole: UserRole) => canManageRole(user?.role as UserRole | undefined, targetRole), [user?.role]);
};

/**
 * Hook: Guard hook that prevents rendering if user lacks access
 * Usage: useGuard(Feature.EDIT_USER, 'You cannot edit users');
 */
export const useGuard = (feature: Feature, errorMessage?: string): boolean => {
  const { user } = useAuth();
  const hasAccess = useMemo(() => canAccess(user?.role as UserRole | undefined, feature), [user?.role, feature]);

  // Intentionally avoid console logging here

  return hasAccess;
};

/**
 * Hook: Get user's permission level (0-4)
 * Usage: const level = usePermissionLevel();
 */
export const usePermissionLevel = (): number => {
  const { user } = useAuth();
  return useMemo(() => getRoleLevel(user?.role as UserRole | undefined), [user?.role]);
};

/**
 * Hook: Get role information for current user
 * Returns display name, description, color, and icon
 * Usage: const roleInfo = useRoleInfo();
 */
export const useRoleInfo = (): { displayName: string; description: string; color: string; icon: string } => {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user?.role) {
      return { displayName: 'مستخدم', description: 'دور غير معروف', color: 'gray', icon: 'user' };
    }
    const { ROLE_METADATA } = require('@/types/roles');
    return ROLE_METADATA[user.role] || { displayName: 'مستخدم', description: 'دور غير معروف', color: 'gray', icon: 'user' };
  }, [user?.role]);
};

/**
 * Hook: Check if current user can perform a data mutation
 * Combines permission check with optional additional validation
 * Usage: const canDelete = useCanMutate(Feature.DELETE_USER, () => targetUser.id !== currentUser.id);
 */
export const useCanMutate = (feature: Feature, additionalCheck?: () => boolean): boolean => {
  const hasAccess = useCanAccess(feature);
  return hasAccess && (additionalCheck ? additionalCheck() : true);
};

// Re-export types for use in components
export type { UserRole, Feature } from '@/types/roles';
