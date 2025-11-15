/**
 * Role-Based UI Components
 * 
 * Declarative components for controlling UI visibility based on user roles.
 * Use these to wrap sections of your UI that should only be visible to certain roles.
 */

'use client';

import React, { ReactNode } from 'react';
import { UserRole } from '@/types/roles';
import {
  hasAnyRole,
  hasRoleOrHigher,
  getRoleNameAr,
  getRoleColor,
  getRoleIcon,
} from '@/utils/roleBasedUI';

/**
 * Props for role-based components
 */
interface RoleBasedProps {
  children: ReactNode;
  userRole?: UserRole;
  fallback?: ReactNode;
}

/**
 * Show content only to specific roles
 * 
 * @example
 * <RoleView roles={[UserRole.PrimaryAdmin, UserRole.SecondaryAdmin]} userRole={user.role}>
 *   <AdminPanel />
 * </RoleView>
 */
export interface RoleViewProps extends RoleBasedProps {
  roles: UserRole[];
}

export function RoleView({ children, userRole, roles, fallback }: RoleViewProps) {
  const canView = hasAnyRole(userRole, roles);
  return canView ? <>{children}</> : <>{fallback ?? null}</>;
}

/**
 * Show content to a role and all higher roles
 * 
 * @example
 * <RoleViewOrHigher minRole={UserRole.Moderator} userRole={user.role}>
 *   <ModeratorFeature />
 * </RoleViewOrHigher>
 */
export interface RoleViewOrHigherProps extends RoleBasedProps {
  minRole: UserRole;
}

export function RoleViewOrHigher({ children, userRole, minRole, fallback }: RoleViewOrHigherProps) {
  const canView = hasRoleOrHigher(userRole, minRole);
  return canView ? <>{children}</> : <>{fallback ?? null}</>;
}

/**
 * Conditional rendering based on role
 * 
 * @example
 * <RoleSwitch userRole={user.role}>
 *   <RoleCase role={UserRole.PrimaryAdmin}>
 *     <PrimaryAdminUI />
 *   </RoleCase>
 *   <RoleCase role={UserRole.Moderator}>
 *     <ModeratorUI />
 *   </RoleCase>
 *   <RoleDefault>
 *     <DefaultUI />
 *   </RoleDefault>
 * </RoleSwitch>
 */
interface RoleSwitchProps {
  userRole?: UserRole;
  children: ReactNode;
}

export function RoleSwitch({ userRole, children }: RoleSwitchProps) {
  return <>{React.Children.toArray(children).find((child: any) => {
    if (!child) return false;
    
    // Check if it's a RoleCase
    if (child.type === RoleCase) {
      return child.props.role === userRole;
    }
    
    // Check if it's a RoleDefault (always matches if no RoleCase matched)
    if (child.type === RoleDefault) {
      const hasMatchingCase = React.Children.toArray(children).some(
        (sibling: any) => sibling?.type === RoleCase && sibling.props.role === userRole
      );
      return !hasMatchingCase;
    }
    
    return false;
  })}</>;
}

/**
 * Case for RoleSwitch - shows content if role matches
 */
interface RoleCaseProps {
  role: UserRole;
  children: ReactNode;
}

export function RoleCase({ children }: RoleCaseProps) {
  return <>{children}</>;
}

/**
 * Default case for RoleSwitch - shows if no RoleCase matched
 */
interface RoleDefaultProps {
  children: ReactNode;
}

export function RoleDefault({ children }: RoleDefaultProps) {
  return <>{children}</>;
}

/**
 * Role Guard - Prevents rendering of entire component if user doesn't have required role
 * Useful for pages or sections that should be completely hidden
 * 
 * @example
 * <RoleGuard requiredRoles={[UserRole.PrimaryAdmin]} userRole={user.role}>
 *   <AdminOnlyPage />
 * </RoleGuard>
 */
interface RoleGuardProps extends RoleBasedProps {
  requiredRoles: UserRole[];
  errorComponent?: ReactNode;
}

export function RoleGuard({
  children,
  userRole,
  requiredRoles,
  errorComponent,
}: RoleGuardProps) {
  const hasAccess = hasAnyRole(userRole, requiredRoles);

  if (!hasAccess) {
    return (
      <>
        {errorComponent ?? (
          <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
              <div className="flex items-center justify-center mb-4">
                <i className="fas fa-lock text-red-500 text-4xl"></i>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
                Access Denied
              </h1>
              <p className="text-gray-600 text-center">
                You don't have permission to access this page.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
}

/**
 * Role Badge - Display role with styling
 * 
 * @example
 * <RoleBadge role={UserRole.Moderator} />
 */
interface RoleBadgeProps {
  role?: UserRole;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function RoleBadge({ role, size = 'md', showIcon = true }: RoleBadgeProps) {
  if (!role) return null;

  const roleColor = getRoleColor(role);
  const roleIcon = getRoleIcon(role);
  const roleName = getRoleNameAr(role);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${roleColor} font-medium ${sizeClasses[size]}`}>
      {showIcon && <i className={`fas ${roleIcon.split(' ')[1]}`}></i>}
      {roleName}
    </span>
  );
}

/**
 * Role Indicator - Shows current user's role
 * 
 * @example
 * <RoleIndicator userRole={user.role} />
 */
interface RoleIndicatorProps {
  userRole?: UserRole;
}

export function RoleIndicator({ userRole }: RoleIndicatorProps) {
  if (!userRole) return null;

  const roleName = getRoleNameAr(userRole);
  const roleIcon = getRoleIcon(userRole);

  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <i className={roleIcon}></i>
      <span>{roleName}</span>
    </div>
  );
}
