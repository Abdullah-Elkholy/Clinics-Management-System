import type { User, UserRole } from '../types';
import { UserRole as UserRoleEnum } from '../types/roles';
import { TEST_CREDENTIALS } from '../constants';

export const authenticateUser = (username: string, password: string): User | null => {
  for (const [key, cred] of Object.entries(TEST_CREDENTIALS)) {
    if (cred.username === username && cred.password === password) {
      // Normalize legacy role values to the canonical enum
      const legacyRole = String(cred.role);
      const normalizedRole: UserRoleEnum =
        legacyRole === 'admin'
          ? UserRoleEnum.PrimaryAdmin
          : legacyRole === 'admin2'
          ? UserRoleEnum.SecondaryAdmin
          : legacyRole === 'moderator'
          ? UserRoleEnum.Moderator
          : UserRoleEnum.User;

      return {
        id: key.toLowerCase(),
        username: cred.username,
        firstName: cred.firstName,
        lastName: cred.lastName,
        role: normalizedRole as unknown as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }
  return null;
};

export const getRoleDisplayName = (role: UserRole | string): string => {
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[getRoleDisplayName] Input role:', role, 'Type:', typeof role);
  }
  
  const names: Record<string, string> = {
    // New enum values
    'primary_admin': 'المدير الأساسي',
    'secondary_admin': 'المدير الثانوي',
    'moderator': 'مشرف',
    'user': 'مستخدم',
    // Legacy support
    'admin': 'المدير الأساسي',
    'admin2': 'المدير الثانوي',
  };
  
  const displayName = names[role] || 'غير محدد';
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[getRoleDisplayName] Output:', displayName);
  }
  
  return displayName;
};
