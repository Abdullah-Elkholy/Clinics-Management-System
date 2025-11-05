import type { User, UserRole } from '../types';
import { UserRole as UserRoleEnum } from '../types/roles';
import { TEST_CREDENTIALS } from '../constants';

export const authenticateUser = (username: string, password: string): User | null => {
  for (const [key, cred] of Object.entries(TEST_CREDENTIALS)) {
    if (cred.username === username && cred.password === password) {
      return {
        id: key.toLowerCase(),
        username: cred.username,
        firstName: cred.firstName,
        lastName: cred.lastName,
        role: cred.role as UserRole,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }
  return null;
};

export const getRoleDisplayName = (role: UserRole | string): string => {
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
  return names[role] || 'غير محدد';
};
