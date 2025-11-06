/**
 * Role-Based UI Utilities
 * 
 * Provides core functions for controlling UI visibility and access based on user roles.
 * Single source of truth for role-based access control logic.
 */

import { UserRole } from '@/types/roles';

/**
 * Role hierarchy definition
 * Higher level roles inherit permissions of lower levels
 * Order: PrimaryAdmin > SecondaryAdmin > Moderator > User
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.PrimaryAdmin]: 4,
  [UserRole.SecondaryAdmin]: 3,
  [UserRole.Moderator]: 2,
  [UserRole.User]: 1,
};

/**
 * Check if a user has a specific role
 */
export function hasRole(userRole: UserRole | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  return userRole === requiredRole;
}

/**
 * Check if a user has any of the specified roles
 */
export function hasAnyRole(userRole: UserRole | undefined, roles: UserRole[]): boolean {
  if (!userRole) return false;
  return roles.includes(userRole);
}

/**
 * Check if a user's role is at or above a certain level (hierarchy-based)
 * Useful for admin-only features where SecondaryAdmin can see what PrimaryAdmin sees
 */
export function hasRoleOrHigher(userRole: UserRole | undefined, minimumRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Check if a user's role is below a certain level
 */
export function hasRoleLower(userRole: UserRole | undefined, maximumRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[maximumRole];
}

/**
 * Check if user is an admin (Primary or Secondary)
 */
export function isAdmin(userRole: UserRole | undefined): boolean {
  return hasAnyRole(userRole, [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin]);
}

/**
 * Check if user is a primary admin
 */
export function isPrimaryAdmin(userRole: UserRole | undefined): boolean {
  return hasRole(userRole, UserRole.PrimaryAdmin);
}

/**
 * Check if user is a secondary admin
 */
export function isSecondaryAdmin(userRole: UserRole | undefined): boolean {
  return hasRole(userRole, UserRole.SecondaryAdmin);
}

/**
 * Check if user is a moderator
 */
export function isModerator(userRole: UserRole | undefined): boolean {
  return hasRole(userRole, UserRole.Moderator);
}

/**
 * Check if user is a regular user
 */
export function isRegularUser(userRole: UserRole | undefined): boolean {
  return hasRole(userRole, UserRole.User);
}

/**
 * Get human-readable role name (Arabic)
 */
export function getRoleNameAr(role: UserRole | undefined): string {
  const roleNames: Record<UserRole, string> = {
    [UserRole.PrimaryAdmin]: 'مسؤول أساسي',
    [UserRole.SecondaryAdmin]: 'مسؤول ثانوي',
    [UserRole.Moderator]: 'مدير',
    [UserRole.User]: 'مستخدم',
  };
  return role ? roleNames[role] : 'غير محدد';
}

/**
 * Get human-readable role name (English)
 */
export function getRoleNameEn(role: UserRole | undefined): string {
  const roleNames: Record<UserRole, string> = {
    [UserRole.PrimaryAdmin]: 'Primary Admin',
    [UserRole.SecondaryAdmin]: 'Secondary Admin',
    [UserRole.Moderator]: 'Moderator',
    [UserRole.User]: 'User',
  };
  return role ? roleNames[role] : 'Unknown';
}

/**
 * Get role color for UI (Tailwind classes)
 */
export function getRoleColor(role: UserRole | undefined): string {
  const colors: Record<UserRole, string> = {
    [UserRole.PrimaryAdmin]: 'bg-red-100 text-red-800 border-red-300',
    [UserRole.SecondaryAdmin]: 'bg-orange-100 text-orange-800 border-orange-300',
    [UserRole.Moderator]: 'bg-blue-100 text-blue-800 border-blue-300',
    [UserRole.User]: 'bg-green-100 text-green-800 border-green-300',
  };
  return role ? colors[role] : 'bg-gray-100 text-gray-800 border-gray-300';
}

/**
 * Get role icon class (FontAwesome)
 */
export function getRoleIcon(role: UserRole | undefined): string {
  const icons: Record<UserRole, string> = {
    [UserRole.PrimaryAdmin]: 'fa-crown',
    [UserRole.SecondaryAdmin]: 'fa-user-shield',
    [UserRole.Moderator]: 'fa-user-tie',
    [UserRole.User]: 'fa-user',
  };
  return role ? `fas ${icons[role]}` : 'fas fa-question-circle';
}

/**
 * Get all roles in order (for dropdowns, selectors)
 */
export function getAllRoles(): UserRole[] {
  return [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator, UserRole.User];
}

/**
 * Get creatable roles (what roles can a user with a certain role create?)
 * - Primary Admin can create: Secondary Admin, Moderator, User
 * - Secondary Admin can create: Moderator, User
 * - Moderator can create: User
 * - User cannot create anyone
 */
export function getCreatableRoles(userRole: UserRole | undefined): UserRole[] {
  if (!userRole) return [];
  
  switch (userRole) {
    case UserRole.PrimaryAdmin:
      return [UserRole.SecondaryAdmin, UserRole.Moderator, UserRole.User];
    case UserRole.SecondaryAdmin:
      return [UserRole.Moderator, UserRole.User];
    case UserRole.Moderator:
      return [UserRole.User];
    case UserRole.User:
      return [];
  }
}

/**
 * Get manageable roles (what roles can a user with a certain role manage/edit?)
 * - Primary Admin can manage: Everyone
 * - Secondary Admin can manage: Moderator, User
 * - Moderator can manage: Users under them only
 * - User cannot manage anyone
 */
export function getManageableRoles(userRole: UserRole | undefined): UserRole[] {
  if (!userRole) return [];
  
  switch (userRole) {
    case UserRole.PrimaryAdmin:
      return [UserRole.SecondaryAdmin, UserRole.Moderator, UserRole.User];
    case UserRole.SecondaryAdmin:
      return [UserRole.Moderator, UserRole.User];
    case UserRole.Moderator:
      return [UserRole.User];
    case UserRole.User:
      return [];
  }
}
