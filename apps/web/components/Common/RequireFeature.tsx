/**
 * Authorization Guard Component - Prevents unauthorized access to UI elements
 * SOLID: Single Responsibility - Only handles conditional rendering based on permissions
 */

'use client';

import React from 'react';
import { Feature, UserRole } from '@/types/roles';
import { canAccess, canAccessAny, canAccessAll } from '@/lib/authz';
import { useAuth } from '@/contexts/AuthContext';

interface RequireFeatureProps {
  /** Feature required to render children */
  feature?: Feature;
  /** Any of these features required */
  requireAny?: Feature[];
  /** All of these features required */
  requireAll?: Feature[];
  /** Role required to render children */
  role?: UserRole;
  /** Fallback UI when access denied */
  fallback?: React.ReactNode;
  /** Children to render if access granted */
  children: React.ReactNode;
  /** Custom validation function */
  validate?: (user: { id: string; role: UserRole }) => boolean;
}

/**
 * Guard component that conditionally renders children based on permissions
 * 
 * Usage examples:
 * 
 * // Single feature check
 * <RequireFeature feature={Feature.EDIT_MESSAGE_TEMPLATE}>
 *   <EditButton />
 * </RequireFeature>
 * 
 * // Multiple features (ANY)
 * <RequireFeature requireAny={[Feature.EDIT_TEMPLATE, Feature.DELETE_TEMPLATE]}>
 *   <ManageButton />
 * </RequireFeature>
 * 
 * // Multiple features (ALL)
 * <RequireFeature requireAll={[Feature.VIEW_USERS, Feature.EDIT_USER]}>
 *   <AdminPanel />
 * </RequireFeature>
 * 
 * // Role check
 * <RequireFeature role={UserRole.PrimaryAdmin}>
 *   <SystemSettings />
 * </RequireFeature>
 * 
 * // With fallback
 * <RequireFeature feature={Feature.DELETE_TEMPLATE} fallback={<div>No permission</div>}>
 *   <DeleteButton />
 * </RequireFeature>
 */
export default function RequireFeature({
  feature,
  requireAny,
  requireAll,
  role,
  fallback = null,
  children,
  validate,
}: RequireFeatureProps) {
  const { user } = useAuth();

  // Check if user has required permissions
  let hasAccess = true;

  if (!user) {
    hasAccess = false;
  } else if (validate) {
    hasAccess = validate(user);
  } else if (feature) {
    hasAccess = canAccess(user?.role as UserRole | undefined, feature);
  } else if (requireAny) {
    hasAccess = canAccessAny(user?.role as UserRole | undefined, requireAny);
  } else if (requireAll) {
    hasAccess = canAccessAll(user?.role as UserRole | undefined, requireAll);
  } else if (role) {
    hasAccess = user?.role === role;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook version of the guard for conditional logic
 * Usage: const hasAccess = useGuard(Feature.DELETE_USER);
 */
export { useGuard } from '@/hooks/useAuthz';

/**
 * Guard button component - Automatically disables based on permissions
 */
interface GuardButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Feature required */
  feature?: Feature;
  /** Fallback text when disabled */
  disabledText?: string;
  /** Hide button when no access */
  hideWhenNoAccess?: boolean;
}

export const GuardButton = React.forwardRef<HTMLButtonElement, GuardButtonProps>(
  ({ feature, disabledText = 'لا توجد صلاحيات', hideWhenNoAccess = false, disabled, children, ...props }, ref) => {
    const { user } = useAuth();
    const hasAccess = feature ? canAccess(user?.role as UserRole | undefined, feature) : true;

    if (!hasAccess && hideWhenNoAccess) {
      return null;
    }

    return (
      <button
        ref={ref}
        disabled={disabled || !hasAccess}
        title={!hasAccess ? disabledText : undefined}
        {...props}
      >
        {children}
      </button>
    );
  }
);

GuardButton.displayName = 'GuardButton';
