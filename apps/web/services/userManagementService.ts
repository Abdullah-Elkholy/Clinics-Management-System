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
export type { User, ModeratorQuota, CreateUserPayload, UpdateUserPayload, UpdateQuotaPayload, AssignModeratorPayload } from '@/types/user';
import type { User, ModeratorQuota, CreateUserPayload, UpdateUserPayload, UpdateQuotaPayload, AssignModeratorPayload } from '@/types/user';

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
 * Mock quotas - Now only for moderators
 */
const mockQuotas: Record<string, ModeratorQuota> = {
  '3': {
    id: 'quota_3',
    moderatorId: '3',
    messagesQuota: {
      limit: 2000,
      used: 890,
      percentage: 45,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 400,
      used: 287,
      percentage: 72,
      isLow: true,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T10:30:00'),
  },
  '4': {
    id: 'quota_4',
    moderatorId: '4',
    messagesQuota: {
      limit: 2000,
      used: 1520,
      percentage: 76,
      isLow: true,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 400,
      used: 145,
      percentage: 36,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T09:15:00'),
  },
  '5': {
    id: 'quota_5',
    moderatorId: '5',
    messagesQuota: {
      limit: 1000,
      used: 450,
      percentage: 45,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 89,
      percentage: 45,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T08:45:00'),
  },
  '6': {
    id: 'quota_6',
    moderatorId: '6',
    messagesQuota: {
      limit: 2000,
      used: 1680,
      percentage: 84,
      isLow: true,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 400,
      used: 312,
      percentage: 78,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T11:20:00'),
  },
  '7': {
    id: 'quota_7',
    moderatorId: '7',
    messagesQuota: {
      limit: 1000,
      used: 750,
      percentage: 75,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 156,
      percentage: 78,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T07:30:00'),
  },
  '8': {
    id: 'quota_8',
    moderatorId: '8',
    messagesQuota: {
      limit: 1000,
      used: 520,
      percentage: 52,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 78,
      percentage: 39,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T06:00:00'),
  },
  '9': {
    id: 'quota_9',
    moderatorId: '9',
    messagesQuota: {
      limit: 2000,
      used: 1680,
      percentage: 84,
      isLow: true,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 400,
      used: 234,
      percentage: 59,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T10:45:00'),
  },
  '10': {
    id: 'quota_10',
    moderatorId: '10',
    messagesQuota: {
      limit: 1000,
      used: 580,
      percentage: 58,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 92,
      percentage: 46,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T12:00:00'),
  },
  '11': {
    id: 'quota_11',
    moderatorId: '11',
    messagesQuota: {
      limit: 1000,
      used: 720,
      percentage: 72,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 145,
      percentage: 73,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T09:00:00'),
  },
  '12': {
    id: 'quota_12',
    moderatorId: '12',
    messagesQuota: {
      limit: 1000,
      used: 320,
      percentage: 32,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 65,
      percentage: 33,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T04:30:00'),
  },
  '13': {
    id: 'quota_13',
    moderatorId: '13',
    messagesQuota: {
      limit: 1000,
      used: 890,
      percentage: 89,
      isLow: true,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 178,
      percentage: 89,
      isLow: true,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T11:30:00'),
  },
  '14': {
    id: 'quota_14',
    moderatorId: '14',
    messagesQuota: {
      limit: 1000,
      used: 615,
      percentage: 62,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 123,
      percentage: 62,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T08:15:00'),
  },
  '15': {
    id: 'quota_15',
    moderatorId: '15',
    messagesQuota: {
      limit: 1000,
      used: 990,
      percentage: 99,
      isLow: true,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 198,
      percentage: 99,
      isLow: true,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T13:00:00'),
  },
  '16': {
    id: 'quota_16',
    moderatorId: '16',
    messagesQuota: {
      limit: 1000,
      used: 435,
      percentage: 44,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 87,
      percentage: 44,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T07:45:00'),
  },
  '17': {
    id: 'quota_17',
    moderatorId: '17',
    messagesQuota: {
      limit: 1000,
      used: 670,
      percentage: 67,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 134,
      percentage: 67,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T10:00:00'),
  },
  '18': {
    id: 'quota_18',
    moderatorId: '18',
    messagesQuota: {
      limit: 1000,
      used: 225,
      percentage: 23,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 45,
      percentage: 23,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T05:00:00'),
  },
  '19': {
    id: 'quota_19',
    moderatorId: '19',
    messagesQuota: {
      limit: 1000,
      used: 835,
      percentage: 84,
      isLow: true,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 167,
      percentage: 84,
      isLow: true,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
    updatedAt: new Date('2024-10-24T11:45:00'),
  },
  '20': {
    id: 'quota_20',
    moderatorId: '20',
    messagesQuota: {
      limit: 1000,
      used: 560,
      percentage: 56,
      isLow: false,
      warningThreshold: 80,
    },
    queuesQuota: {
      limit: 200,
      used: 112,
      percentage: 56,
      isLow: false,
      warningThreshold: 80,
    },
    createdAt: new Date('2024-10-24'),
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
  private quotas: Map<string, ModeratorQuota> = new Map();

  constructor() {
    // Initialize with mock data
    mockUsers.forEach((user) => this.users.set(user.id, { ...user }));
    Object.values(mockQuotas).forEach((quota) => this.quotas.set(quota.moderatorId, { ...quota }));
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

      // Create default quota for moderators only
      // Regular users consume their moderator's quota (no personal quota)
      if (payload.role === UserRole.Moderator) {
        const moderatorQuota: ModeratorQuota = {
          id: `quota_${newUser.id}`,
          moderatorId: newUser.id,
          messagesQuota: {
            limit: payload.initialQuota?.messagesLimit ?? 1000,
            used: 0,
            percentage: 0,
            isLow: false,
            warningThreshold: 80,
          },
          queuesQuota: {
            limit: payload.initialQuota?.queuesLimit ?? 20,
            used: 0,
            percentage: 0,
            isLow: false,
            warningThreshold: 80,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.quotas.set(newUser.id, moderatorQuota);
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
   * Get moderator quota
   * Returns the quota for a moderator (users don't have personal quotas)
   */
  async getQuota(moderatorId: string): Promise<UserServiceResponse<ModeratorQuota>> {
    try {
      const quota = this.quotas.get(moderatorId);
      if (!quota) {
        return { success: false, error: `Quota for moderator ${moderatorId} not found` };
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
   * Update moderator quota limits
   */
  async updateQuotaLimits(
    moderatorId: string,
    limits: { messagesLimit?: number; queuesLimit?: number }
  ): Promise<UserServiceResponse<ModeratorQuota>> {
    try {
      const quota = this.quotas.get(moderatorId);
      if (!quota) {
        return { success: false, error: `Quota for moderator ${moderatorId} not found` };
      }

      const updated: ModeratorQuota = {
        ...quota,
        messagesQuota: {
          ...quota.messagesQuota,
          ...(limits.messagesLimit !== undefined && { limit: limits.messagesLimit }),
        },
        queuesQuota: {
          ...quota.queuesQuota,
          ...(limits.queuesLimit !== undefined && { limit: limits.queuesLimit }),
        },
        updatedAt: new Date(),
      };

      this.quotas.set(moderatorId, updated);
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
