/**
 * User Management Service
 * 
 * Handles all user-related operations including CRUD, role assignment,
 * quota management, and status updates. Follows singleton pattern.
 * 
 * Use this service to manage system users, assign roles, and track quotas.
 * 
 * @example
 * const result = await userManagementService.createUser({
 *   name: 'أحمد علي',
 *   email: 'ahmed@clinic.com',
 *   role: UserRole.Moderator
 * });
 * 
 * if (result.success) {
 *   console.log('User created:', result.data);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 */

import { UserRole } from '@/types/roles';
// Import canonical User type from dedicated file
export type { User, UserQuota, CreateUserPayload, UpdateUserPayload, UpdateQuotaPayload, AssignModeratorPayload } from '@/types/user';
import type { User, UserQuota, CreateUserPayload, UpdateUserPayload, UpdateQuotaPayload, AssignModeratorPayload } from '@/types/user';

/**
 * Service response wrapper
 */
export interface UserServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Mock user data
 */
const mockUsers: User[] = [
  {
    id: '1',
    firstName: 'أحمد',
    lastName: 'محمد',
    username: 'ahmed_admin',
    role: UserRole.PrimaryAdmin,
    createdBy: 'system',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-10-24'),
    isActive: true,
    lastLogin: new Date('2024-10-24'),
  },
  {
    id: '2',
    firstName: 'علي',
    lastName: 'حسن',
    username: 'ali_admin',
    role: UserRole.SecondaryAdmin,
    createdBy: '1',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-10-23'),
    isActive: true,
    lastLogin: new Date('2024-10-23'),
  },
  {
    id: '3',
    firstName: 'فاطمة',
    lastName: 'محمود',
    username: 'fatima_mod',
    role: UserRole.Moderator,
    createdBy: '1',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-10-24'),
    isActive: true,
    lastLogin: new Date('2024-10-24'),
  },
  {
    id: '4',
    firstName: 'محمود',
    lastName: 'علي',
    username: 'mahmoud_mod',
    role: UserRole.Moderator,
    createdBy: '1',
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-10-22'),
    isActive: true,
    lastLogin: new Date('2024-10-22'),
  },
  {
    id: '5',
    firstName: 'نور',
    lastName: 'إبراهيم',
    username: 'noor_user',
    role: UserRole.User,
    createdBy: '3',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-10-21'),
    isActive: true,
    lastLogin: new Date('2024-10-21'),
    assignedModerator: '3',
  },
  {
    id: '6',
    firstName: 'سلمى',
    lastName: 'أحمد',
    username: 'salma_mod',
    role: UserRole.Moderator,
    createdBy: '1',
    createdAt: new Date('2024-03-05'),
    updatedAt: new Date('2024-10-24'),
    isActive: true,
    lastLogin: new Date('2024-10-24'),
  },
  {
    id: '7',
    firstName: 'خالد',
    lastName: 'محمود',
    username: 'khaled_user',
    role: UserRole.User,
    createdBy: '4',
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-10-20'),
    isActive: true,
    lastLogin: new Date('2024-10-20'),
    assignedModerator: '4',
  },
  {
    id: '8',
    firstName: 'ليلى',
    lastName: 'حسن',
    username: 'layla_user',
    role: UserRole.User,
    createdBy: '3',
    createdAt: new Date('2024-03-15'),
    updatedAt: new Date('2024-10-19'),
    isActive: true,
    lastLogin: new Date('2024-10-19'),
    assignedModerator: '3',
  },
  {
    id: '9',
    firstName: 'عمر',
    lastName: 'إبراهيم',
    username: 'omar_mod',
    role: UserRole.Moderator,
    createdBy: '1',
    createdAt: new Date('2024-03-20'),
    updatedAt: new Date('2024-10-23'),
    isActive: true,
    lastLogin: new Date('2024-10-23'),
  },
  {
    id: '10',
    firstName: 'مريم',
    lastName: 'علي',
    username: 'mariam_user',
    role: UserRole.User,
    createdBy: '3',
    createdAt: new Date('2024-04-01'),
    updatedAt: new Date('2024-10-18'),
    isActive: true,
    lastLogin: new Date('2024-10-18'),
    assignedModerator: '4',
  },
  {
    id: '11',
    firstName: 'يوسف',
    lastName: 'محمد',
    username: 'youssef_user',
    role: UserRole.User,
    createdBy: '6',
    createdAt: new Date('2024-04-05'),
    updatedAt: new Date('2024-10-17'),
    isActive: true,
    lastLogin: new Date('2024-10-17'),
    assignedModerator: '6',
  },
  {
    id: '12',
    firstName: 'هناء',
    lastName: 'أحمد',
    username: 'hanaa_user',
    role: UserRole.User,
    createdBy: '3',
    createdAt: new Date('2024-04-10'),
    updatedAt: new Date('2024-10-16'),
    isActive: false,
    lastLogin: new Date('2024-10-10'),
    assignedModerator: '3',
  },
  {
    id: '13',
    firstName: 'إبراهيم',
    lastName: 'حسين',
    username: 'ibrahim_user',
    role: UserRole.User,
    createdBy: '9',
    createdAt: new Date('2024-04-15'),
    updatedAt: new Date('2024-10-24'),
    isActive: true,
    lastLogin: new Date('2024-10-24'),
    assignedModerator: '9',
  },
  {
    id: '14',
    firstName: 'جميلة',
    lastName: 'محمود',
    username: 'jamila_user',
    role: UserRole.User,
    createdBy: '6',
    createdAt: new Date('2024-04-20'),
    updatedAt: new Date('2024-10-15'),
    isActive: true,
    lastLogin: new Date('2024-10-15'),
    assignedModerator: '6',
  },
  {
    id: '15',
    firstName: 'رياض',
    lastName: 'علي',
    username: 'riyad_user',
    role: UserRole.User,
    createdBy: '4',
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2024-10-14'),
    isActive: true,
    lastLogin: new Date('2024-10-14'),
    assignedModerator: '4',
  },
  {
    id: '16',
    firstName: 'نادية',
    lastName: 'إبراهيم',
    username: 'nadia_user',
    role: UserRole.User,
    createdBy: '3',
    createdAt: new Date('2024-05-05'),
    updatedAt: new Date('2024-10-22'),
    isActive: true,
    lastLogin: new Date('2024-10-22'),
    assignedModerator: '3',
  },
  {
    id: '17',
    firstName: 'صلاح',
    lastName: 'محمد',
    username: 'salah_user',
    role: UserRole.User,
    createdBy: '9',
    createdAt: new Date('2024-05-10'),
    updatedAt: new Date('2024-10-13'),
    isActive: true,
    lastLogin: new Date('2024-10-13'),
    assignedModerator: '9',
  },
  {
    id: '18',
    firstName: 'فرح',
    lastName: 'حسن',
    username: 'farah_user',
    role: UserRole.User,
    createdBy: '6',
    createdAt: new Date('2024-05-15'),
    updatedAt: new Date('2024-10-12'),
    isActive: false,
    lastLogin: new Date('2024-09-28'),
    assignedModerator: '6',
  },
  {
    id: '19',
    firstName: 'أسامة',
    lastName: 'أحمد',
    username: 'osama_user',
    role: UserRole.User,
    createdBy: '4',
    createdAt: new Date('2024-05-20'),
    updatedAt: new Date('2024-10-24'),
    isActive: true,
    lastLogin: new Date('2024-10-24'),
    assignedModerator: '4',
  },
  {
    id: '20',
    firstName: 'زينب',
    lastName: 'علي',
    username: 'zainab_user',
    role: UserRole.User,
    createdBy: '3',
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-10-11'),
    isActive: true,
    lastLogin: new Date('2024-10-11'),
    assignedModerator: '3',
  },
];

/**
 * Mock quotas
 */
const mockQuotas: Record<string, UserQuota> = {
  '3': {
    id: 'quota_3',
    userId: '3',
    dailyMessageLimit: 100,
    monthlyMessageLimit: 2000,
    currentDayMessages: 45,
    currentMonthMessages: 890,
    dailyQueueLimit: 20,
    monthlyQueueLimit: 400,
    currentMonthQueues: 287,
    currentDayQueues: 15,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T10:30:00'),
  },
  '4': {
    id: 'quota_4',
    userId: '4',
    dailyMessageLimit: 100,
    monthlyMessageLimit: 2000,
    currentDayMessages: 32,
    currentMonthMessages: 1520,
    dailyQueueLimit: 20,
    monthlyQueueLimit: 400,
    currentMonthQueues: 145,
    currentDayQueues: 8,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T09:15:00'),
  },
  '5': {
    id: 'quota_5',
    userId: '5',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 20,
    currentMonthMessages: 450,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 89,
    currentDayQueues: 5,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T08:45:00'),
  },
  '6': {
    id: 'quota_6',
    userId: '6',
    dailyMessageLimit: 100,
    monthlyMessageLimit: 2000,
    currentDayMessages: 68,
    currentMonthMessages: 1680,
    dailyQueueLimit: 20,
    monthlyQueueLimit: 400,
    currentMonthQueues: 312,
    currentDayQueues: 18,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T11:20:00'),
  },
  '7': {
    id: 'quota_7',
    userId: '7',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 28,
    currentMonthMessages: 750,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 156,
    currentDayQueues: 9,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T07:30:00'),
  },
  '8': {
    id: 'quota_8',
    userId: '8',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 15,
    currentMonthMessages: 520,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 78,
    currentDayQueues: 4,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T06:00:00'),
  },
  '9': {
    id: 'quota_9',
    userId: '9',
    dailyMessageLimit: 100,
    monthlyMessageLimit: 2000,
    currentDayMessages: 55,
    currentMonthMessages: 1680,
    dailyQueueLimit: 20,
    monthlyQueueLimit: 400,
    currentMonthQueues: 234,
    currentDayQueues: 12,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T10:45:00'),
  },
  '10': {
    id: 'quota_10',
    userId: '10',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 22,
    currentMonthMessages: 580,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 92,
    currentDayQueues: 6,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T12:00:00'),
  },
  '11': {
    id: 'quota_11',
    userId: '11',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 35,
    currentMonthMessages: 720,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 145,
    currentDayQueues: 7,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T09:00:00'),
  },
  '12': {
    id: 'quota_12',
    userId: '12',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 0,
    currentMonthMessages: 320,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 65,
    currentDayQueues: 0,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T04:30:00'),
  },
  '13': {
    id: 'quota_13',
    userId: '13',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 42,
    currentMonthMessages: 890,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 178,
    currentDayQueues: 10,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T11:30:00'),
  },
  '14': {
    id: 'quota_14',
    userId: '14',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 18,
    currentMonthMessages: 615,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 123,
    currentDayQueues: 5,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T08:15:00'),
  },
  '15': {
    id: 'quota_15',
    userId: '15',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 48,
    currentMonthMessages: 990,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 198,
    currentDayQueues: 9,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T13:00:00'),
  },
  '16': {
    id: 'quota_16',
    userId: '16',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 25,
    currentMonthMessages: 435,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 87,
    currentDayQueues: 6,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T07:45:00'),
  },
  '17': {
    id: 'quota_17',
    userId: '17',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 32,
    currentMonthMessages: 670,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 134,
    currentDayQueues: 8,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T10:00:00'),
  },
  '18': {
    id: 'quota_18',
    userId: '18',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 0,
    currentMonthMessages: 225,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 45,
    currentDayQueues: 0,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T05:00:00'),
  },
  '19': {
    id: 'quota_19',
    userId: '19',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 38,
    currentMonthMessages: 835,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 167,
    currentDayQueues: 9,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T11:45:00'),
  },
  '20': {
    id: 'quota_20',
    userId: '20',
    dailyMessageLimit: 50,
    monthlyMessageLimit: 1000,
    currentDayMessages: 28,
    currentMonthMessages: 560,
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 112,
    currentDayQueues: 7,
    lastResetDate: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T09:30:00'),
  },
};

/**
 * User Management Service
 * 
 * Singleton service for user operations. Can be replaced with API calls.
 */
class UserManagementService {
  private users: Map<string, User> = new Map();
  private quotas: Map<string, UserQuota> = new Map();

  constructor() {
    // Initialize with mock data
    mockUsers.forEach((user) => this.users.set(user.id, { ...user }));
    Object.values(mockQuotas).forEach((quota) => this.quotas.set(quota.userId, { ...quota }));
  }

  /**
   * Get all users
   */
  async getUsers(filters?: {
    role?: UserRole;
    isActive?: boolean;
    search?: string;
  }): Promise<UserServiceResponse<User[]>> {
    try {
      let users = Array.from(this.users.values());

      if (filters?.role) {
        users = users.filter((u) => u.role === filters.role);
      }

      if (filters?.isActive !== undefined) {
        users = users.filter((u) => u.isActive === filters.isActive);
      }

      if (filters?.search) {
        const search = filters.search.toLowerCase();
        users = users.filter(
          (u) =>
            `${u.firstName} ${u.lastName}`.toLowerCase().includes(search) ||
            u.username.toLowerCase().includes(search)
        );
      }

      return { success: true, data: users.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)) };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get single user
   */
  async getUser(id: string): Promise<UserServiceResponse<User>> {
    try {
      const user = this.users.get(id);
      if (!user) {
        return { success: false, error: `User with id ${id} not found` };
      }
      return { success: true, data: { ...user } };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Create new user
   */
  async createUser(payload: CreateUserPayload): Promise<UserServiceResponse<User>> {
    try {
      // Validate payload
      const validation = this.validateUserPayload(payload);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Check duplicate username
      const usernameExists = Array.from(this.users.values()).some((u) => u.username === payload.username);
      if (usernameExists) {
        return { success: false, error: 'Username already in use' };
      }

      const newUser: User = {
        id: String(Date.now()),
        firstName: payload.firstName,
        lastName: payload.lastName,
        username: payload.username,
        role: payload.role,
        createdBy: payload.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        assignedModerator: payload.assignedModerator,
      };

      this.users.set(newUser.id, newUser);

      // Create default quota for moderators and users
      if (payload.role === UserRole.Moderator) {
        const moderatorQuota: UserQuota = {
          id: `quota_${newUser.id}`,
          userId: newUser.id,
          dailyMessageLimit: payload.initialQuota?.dailyMessageLimit ?? 100,
          monthlyMessageLimit: payload.initialQuota?.monthlyMessageLimit ?? 2000,
          currentDayMessages: 0,
          currentMonthMessages: 0,
          dailyQueueLimit: payload.initialQuota?.dailyQueueLimit ?? 20,
          monthlyQueueLimit: payload.initialQuota?.monthlyQueueLimit ?? 400,
          currentMonthQueues: 0,
          currentDayQueues: 0,
          lastResetDate: new Date(),
          updatedAt: new Date(),
        };
        this.quotas.set(newUser.id, moderatorQuota);
        newUser.quota = moderatorQuota;
      } else if (payload.role === UserRole.User) {
        const userQuota: UserQuota = {
          id: `quota_${newUser.id}`,
          userId: newUser.id,
          dailyMessageLimit: payload.initialQuota?.dailyMessageLimit ?? 50,
          monthlyMessageLimit: payload.initialQuota?.monthlyMessageLimit ?? 1000,
          currentDayMessages: 0,
          currentMonthMessages: 0,
          dailyQueueLimit: payload.initialQuota?.dailyQueueLimit ?? 10,
          monthlyQueueLimit: payload.initialQuota?.monthlyQueueLimit ?? 200,
          currentMonthQueues: 0,
          currentDayQueues: 0,
          lastResetDate: new Date(),
          updatedAt: new Date(),
        };
        this.quotas.set(newUser.id, userQuota);
        newUser.quota = userQuota;
      }

      return { success: true, data: newUser };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Update user
   */
  async updateUser(id: string, payload: UpdateUserPayload): Promise<UserServiceResponse<User>> {
    try {
      const user = this.users.get(id);
      if (!user) {
        return { success: false, error: `User with id ${id} not found` };
      }

      const updated: User = {
        ...user,
        ...(payload.firstName !== undefined && { firstName: payload.firstName }),
        ...(payload.lastName !== undefined && { lastName: payload.lastName }),
        ...(payload.role !== undefined && { role: payload.role }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive }),
        ...(payload.assignedModerator !== undefined && { assignedModerator: payload.assignedModerator }),
        updatedAt: new Date(),
      };

      this.users.set(id, updated);
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<UserServiceResponse<void>> {
    try {
      const user = this.users.get(id);
      if (!user) {
        return { success: false, error: `User with id ${id} not found` };
      }

      // Prevent deleting self (in real app, check against current user)
      if (id === '1') {
        return { success: false, error: 'Cannot delete primary admin' };
      }

      this.users.delete(id);
      this.quotas.delete(id);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get user quota
   */
  async getQuota(userId: string): Promise<UserServiceResponse<UserQuota>> {
    try {
      const quota = this.quotas.get(userId);
      if (!quota) {
        return { success: false, error: `Quota for user ${userId} not found` };
      }
      return { success: true, data: { ...quota } };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch quota: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Update user quota limits
   */
  async updateQuotaLimits(
    userId: string,
    limits: { dailyLimit?: number; monthlyLimit?: number }
  ): Promise<UserServiceResponse<UserQuota>> {
    try {
      const quota = this.quotas.get(userId);
      if (!quota) {
        return { success: false, error: `Quota for user ${userId} not found` };
      }

      const updated: UserQuota = {
        ...quota,
        ...(limits.dailyLimit !== undefined && { dailyQueueLimit: limits.dailyLimit }),
        ...(limits.monthlyLimit !== undefined && { monthlyQueueLimit: limits.monthlyLimit }),
        updatedAt: new Date(),
      };

      this.quotas.set(userId, updated);
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update quota: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Assign moderator to user
   */
  async assignModerator(payload: AssignModeratorPayload): Promise<UserServiceResponse<User>> {
    try {
      const user = this.users.get(payload.userId);
      if (!user) {
        return { success: false, error: `User with id ${payload.userId} not found` };
      }

      // Verify moderator exists (if assigning)
      if (payload.moderatorId) {
        const moderator = this.users.get(payload.moderatorId);
        if (!moderator || moderator.role !== UserRole.Moderator) {
          return { success: false, error: 'Moderator not found or invalid' };
        }
      }

      const updated: User = {
        ...user,
        assignedModerator: payload.moderatorId,
        updatedAt: new Date(),
      };

      this.users.set(payload.userId, updated);
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: `Failed to assign moderator: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get users assigned to a moderator
   */
  async getUsersByModerator(moderatorId: string): Promise<UserServiceResponse<User[]>> {
    try {
      const users = Array.from(this.users.values()).filter(
        (u) => u.assignedModerator === moderatorId && u.role === UserRole.User
      );
      return { success: true, data: users };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get all moderators
   */
  async getModerators(): Promise<UserServiceResponse<User[]>> {
    try {
      const moderators = Array.from(this.users.values()).filter(
        (u) => u.role === UserRole.Moderator && u.isActive
      );
      return { success: true, data: moderators };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch moderators: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate user payload
   */
  private validateUserPayload(payload: Partial<CreateUserPayload>): { valid: boolean; error?: string } {
    if (!payload.firstName || payload.firstName.trim().length === 0) {
      return { valid: false, error: 'First name is required' };
    }

    if (!payload.lastName || payload.lastName.trim().length === 0) {
      return { valid: false, error: 'Last name is required' };
    }

    if (!payload.username || payload.username.trim().length === 0) {
      return { valid: false, error: 'Username is required' };
    }

    if (!payload.role) {
      return { valid: false, error: 'Role is required' };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const userManagementService = new UserManagementService();

export default userManagementService;
