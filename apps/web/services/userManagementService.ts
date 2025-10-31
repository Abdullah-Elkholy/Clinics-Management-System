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

/**
 * User data model
 */
export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  lastLogin?: Date;
  assignedModerator?: string; // For users assigned to moderators
}

/**
 * User creation payload
 */
export interface CreateUserPayload {
  name: string;
  username: string;
  role: UserRole;
  assignedModerator?: string;
}

/**
 * User update payload
 */
export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  assignedModerator?: string;
}

/**
 * Moderator assignment payload
 */
export interface AssignModeratorPayload {
  userId: string;
  moderatorId?: string; // undefined = remove assignment
}

/**
 * Quota information
 */
export interface UserQuota {
  userId: string;
  dailyQueueLimit: number;
  monthlyQueueLimit: number;
  currentMonthQueues: number;
  currentDayQueues: number;
  remainingQuota: number;
}

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
    name: 'أحمد محمد',
    username: 'ahmed_admin',
    role: UserRole.PrimaryAdmin,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-10-24'),
    isActive: true,
    lastLogin: new Date('2024-10-24'),
  },
  {
    id: '2',
    name: 'علي حسن',
    username: 'ali_admin',
    role: UserRole.SecondaryAdmin,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-10-23'),
    isActive: true,
    lastLogin: new Date('2024-10-23'),
  },
  {
    id: '3',
    name: 'فاطمة محمود',
    username: 'fatima_mod',
    role: UserRole.Moderator,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-10-24'),
    isActive: true,
    lastLogin: new Date('2024-10-24'),
  },
  {
    id: '4',
    name: 'محمود علي',
    username: 'mahmoud_mod',
    role: UserRole.Moderator,
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-10-22'),
    isActive: true,
    lastLogin: new Date('2024-10-22'),
  },
  {
    id: '5',
    name: 'نور إبراهيم',
    username: 'noor_user',
    role: UserRole.User,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-10-21'),
    isActive: true,
    lastLogin: new Date('2024-10-21'),
    assignedModerator: '3',
  },
  {
    id: '6',
    name: 'سلمى أحمد',
    username: 'salma_mod',
    role: UserRole.Moderator,
    createdAt: new Date('2024-03-05'),
    updatedAt: new Date('2024-10-24'),
    isActive: true,
    lastLogin: new Date('2024-10-24'),
  },
  {
    id: '7',
    name: 'خالد محمود',
    username: 'khaled_user',
    role: UserRole.User,
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-10-20'),
    isActive: true,
    lastLogin: new Date('2024-10-20'),
    assignedModerator: '4',
  },
  {
    id: '8',
    name: 'ليلى حسن',
    username: 'layla_user',
    role: UserRole.User,
    createdAt: new Date('2024-03-15'),
    updatedAt: new Date('2024-10-19'),
    isActive: true,
    lastLogin: new Date('2024-10-19'),
    assignedModerator: '3',
  },
  {
    id: '9',
    name: 'عمر إبراهيم',
    username: 'omar_mod',
    role: UserRole.Moderator,
    createdAt: new Date('2024-03-20'),
    updatedAt: new Date('2024-10-23'),
    isActive: true,
    lastLogin: new Date('2024-10-23'),
  },
  {
    id: '10',
    name: 'مريم علي',
    username: 'mariam_user',
    role: UserRole.User,
    createdAt: new Date('2024-04-01'),
    updatedAt: new Date('2024-10-18'),
    isActive: true,
    lastLogin: new Date('2024-10-18'),
    assignedModerator: '4',
  },
  {
    id: '11',
    name: 'يوسف محمد',
    username: 'youssef_user',
    role: UserRole.User,
    createdAt: new Date('2024-04-05'),
    updatedAt: new Date('2024-10-17'),
    isActive: true,
    lastLogin: new Date('2024-10-17'),
    assignedModerator: '6',
  },
  {
    id: '12',
    name: 'هناء أحمد',
    username: 'hanaa_user',
    role: UserRole.User,
    createdAt: new Date('2024-04-10'),
    updatedAt: new Date('2024-10-16'),
    isActive: false,
    lastLogin: new Date('2024-10-10'),
    assignedModerator: '3',
  },
  {
    id: '13',
    name: 'إبراهيم حسين',
    username: 'ibrahim_user',
    role: UserRole.User,
    createdAt: new Date('2024-04-15'),
    updatedAt: new Date('2024-10-24'),
    isActive: true,
    lastLogin: new Date('2024-10-24'),
    assignedModerator: '9',
  },
  {
    id: '14',
    name: 'جميلة محمود',
    username: 'jamila_user',
    role: UserRole.User,
    createdAt: new Date('2024-04-20'),
    updatedAt: new Date('2024-10-15'),
    isActive: true,
    lastLogin: new Date('2024-10-15'),
    assignedModerator: '6',
  },
  {
    id: '15',
    name: 'رياض علي',
    username: 'riyad_user',
    role: UserRole.User,
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2024-10-14'),
    isActive: true,
    lastLogin: new Date('2024-10-14'),
    assignedModerator: '4',
  },
  {
    id: '16',
    name: 'نادية إبراهيم',
    username: 'nadia_user',
    role: UserRole.User,
    createdAt: new Date('2024-05-05'),
    updatedAt: new Date('2024-10-22'),
    isActive: true,
    lastLogin: new Date('2024-10-22'),
    assignedModerator: '3',
  },
  {
    id: '17',
    name: 'صلاح محمد',
    username: 'salah_user',
    role: UserRole.User,
    createdAt: new Date('2024-05-10'),
    updatedAt: new Date('2024-10-13'),
    isActive: true,
    lastLogin: new Date('2024-10-13'),
    assignedModerator: '9',
  },
  {
    id: '18',
    name: 'فرح حسن',
    username: 'farah_user',
    role: UserRole.User,
    createdAt: new Date('2024-05-15'),
    updatedAt: new Date('2024-10-12'),
    isActive: false,
    lastLogin: new Date('2024-09-28'),
    assignedModerator: '6',
  },
  {
    id: '19',
    name: 'أسامة أحمد',
    username: 'osama_user',
    role: UserRole.User,
    createdAt: new Date('2024-05-20'),
    updatedAt: new Date('2024-10-24'),
    isActive: true,
    lastLogin: new Date('2024-10-24'),
    assignedModerator: '4',
  },
  {
    id: '20',
    name: 'زينب علي',
    username: 'zainab_user',
    role: UserRole.User,
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
    userId: '3',
    dailyQueueLimit: 20,
    monthlyQueueLimit: 400,
    currentMonthQueues: 287,
    currentDayQueues: 15,
    remainingQuota: 113,
  },
  '4': {
    userId: '4',
    dailyQueueLimit: 20,
    monthlyQueueLimit: 400,
    currentMonthQueues: 145,
    currentDayQueues: 8,
    remainingQuota: 255,
  },
  '5': {
    userId: '5',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 89,
    currentDayQueues: 5,
    remainingQuota: 111,
  },
  '6': {
    userId: '6',
    dailyQueueLimit: 20,
    monthlyQueueLimit: 400,
    currentMonthQueues: 312,
    currentDayQueues: 18,
    remainingQuota: 88,
  },
  '7': {
    userId: '7',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 156,
    currentDayQueues: 9,
    remainingQuota: 44,
  },
  '8': {
    userId: '8',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 78,
    currentDayQueues: 4,
    remainingQuota: 122,
  },
  '9': {
    userId: '9',
    dailyQueueLimit: 20,
    monthlyQueueLimit: 400,
    currentMonthQueues: 234,
    currentDayQueues: 12,
    remainingQuota: 166,
  },
  '10': {
    userId: '10',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 92,
    currentDayQueues: 6,
    remainingQuota: 108,
  },
  '11': {
    userId: '11',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 145,
    currentDayQueues: 7,
    remainingQuota: 55,
  },
  '12': {
    userId: '12',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 65,
    currentDayQueues: 0,
    remainingQuota: 135,
  },
  '13': {
    userId: '13',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 178,
    currentDayQueues: 10,
    remainingQuota: 22,
  },
  '14': {
    userId: '14',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 123,
    currentDayQueues: 5,
    remainingQuota: 77,
  },
  '15': {
    userId: '15',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 198,
    currentDayQueues: 9,
    remainingQuota: 2,
  },
  '16': {
    userId: '16',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 87,
    currentDayQueues: 6,
    remainingQuota: 113,
  },
  '17': {
    userId: '17',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 134,
    currentDayQueues: 8,
    remainingQuota: 66,
  },
  '18': {
    userId: '18',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 45,
    currentDayQueues: 0,
    remainingQuota: 155,
  },
  '19': {
    userId: '19',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 167,
    currentDayQueues: 9,
    remainingQuota: 33,
  },
  '20': {
    userId: '20',
    dailyQueueLimit: 10,
    monthlyQueueLimit: 200,
    currentMonthQueues: 112,
    currentDayQueues: 7,
    remainingQuota: 88,
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
            u.name.toLowerCase().includes(search) ||
            u.username.toLowerCase().includes(search)
        );
      }

      return { success: true, data: users.sort((a, b) => a.name.localeCompare(b.name)) };
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
        name: payload.name,
        username: payload.username,
        role: payload.role,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        assignedModerator: payload.assignedModerator,
      };

      this.users.set(newUser.id, newUser);

      // Create default quota for moderators and users
      if (payload.role === UserRole.Moderator) {
        this.quotas.set(newUser.id, {
          userId: newUser.id,
          dailyQueueLimit: 20,
          monthlyQueueLimit: 400,
          currentMonthQueues: 0,
          currentDayQueues: 0,
          remainingQuota: 400,
        });
      } else if (payload.role === UserRole.User) {
        this.quotas.set(newUser.id, {
          userId: newUser.id,
          dailyQueueLimit: 10,
          monthlyQueueLimit: 200,
          currentMonthQueues: 0,
          currentDayQueues: 0,
          remainingQuota: 200,
        });
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
        ...(payload.name !== undefined && { name: payload.name }),
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
      };

      // Recalculate remaining quota
      updated.remainingQuota = updated.monthlyQueueLimit - updated.currentMonthQueues;

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
    if (!payload.name || payload.name.trim().length === 0) {
      return { valid: false, error: 'Name is required' };
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
