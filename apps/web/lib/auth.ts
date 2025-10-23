import type { User, UserRole } from '../types';
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
      };
    }
  }
  return null;
};

export const getRoleDisplayName = (role: UserRole): string => {
  const names: Record<UserRole, string> = {
    admin: 'مدير أساسي',
    admin2: 'مدير ثانوي',
    moderator: 'مشرف',
    user: 'مستخدم',
  };
  return names[role];
};
