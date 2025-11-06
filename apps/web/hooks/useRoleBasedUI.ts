/**
 * useRoleBasedUI Hook
 * 
 * Provides easy access to role-based UI logic and current user's role information.
 * Use this in components to conditionally render UI based on user role.
 */

import { useCallback, useMemo } from 'react';
import { UserRole } from '@/types/roles';
import {
  hasRole,
  hasAnyRole,
  hasRoleOrHigher,
  hasRoleLower,
  isAdmin,
  isPrimaryAdmin,
  isSecondaryAdmin,
  isModerator,
  isRegularUser,
  getCreatableRoles,
  getManageableRoles,
  getRoleNameAr,
  getRoleNameEn,
  getRoleColor,
  getRoleIcon,
} from '@/utils/roleBasedUI';

/**
 * Hook options for customization
 */
interface UseRoleBasedUIOptions {
  userRole?: UserRole;
}

/**
 * Role-based UI hook
 */
export function useRoleBasedUI(options?: UseRoleBasedUIOptions) {
  const userRole = options?.userRole;

  // Memoized permission checkers
  const permissions = useMemo(
    () => ({
      hasRole: (role: UserRole) => hasRole(userRole, role),
      hasAnyRole: (roles: UserRole[]) => hasAnyRole(userRole, roles),
      hasRoleOrHigher: (minRole: UserRole) => hasRoleOrHigher(userRole, minRole),
      hasRoleLower: (maxRole: UserRole) => hasRoleLower(userRole, maxRole),
      isAdmin: () => isAdmin(userRole),
      isPrimaryAdmin: () => isPrimaryAdmin(userRole),
      isSecondaryAdmin: () => isSecondaryAdmin(userRole),
      isModerator: () => isModerator(userRole),
      isRegularUser: () => isRegularUser(userRole),
    }),
    [userRole]
  );

  // Memoized role information
  const roleInfo = useMemo(
    () => ({
      creatableRoles: getCreatableRoles(userRole),
      manageableRoles: getManageableRoles(userRole),
      nameAr: getRoleNameAr(userRole),
      nameEn: getRoleNameEn(userRole),
      color: getRoleColor(userRole),
      icon: getRoleIcon(userRole),
      current: userRole,
    }),
    [userRole]
  );

  // Helper to check if can perform action
  const canPerformAction = useCallback(
    (action: string): boolean => {
      // Map actions to role requirements
      // This can be extended based on your needs
      const actionPermissions: Record<string, (perms: typeof permissions) => boolean> = {
        'manage_users': (p) => p.isAdmin(),
        'manage_moderators': (p) => p.isPrimaryAdmin(),
        'view_quotas': (p) => p.isAdmin(),
        'create_moderator': (p) => p.isPrimaryAdmin(),
        'create_queue': (p) => !p.isRegularUser(),
        'view_all_queues': (p) => p.isAdmin(),
        'manage_templates': (p) => !p.isRegularUser(),
        'view_all_templates': (p) => p.isAdmin(),
      };

      const checker = actionPermissions[action];
      return checker ? checker(permissions) : false;
    },
    [permissions]
  );

  return {
    userRole,
    permissions,
    roleInfo,
    canPerformAction,
    canView: (requiredRoles: UserRole[]) => permissions.hasAnyRole(requiredRoles),
    canEdit: (requiredRoles: UserRole[]) => permissions.hasAnyRole(requiredRoles),
  };
}
