/**
 * User Management Service - API-Driven
 */
import { UserRole } from '@/types/roles';
import { usersApiClient, userDtoToModel } from '@/services/api/usersApiClient';

export type { User, ModeratorQuota, CreateUserPayload, UpdateUserPayload, UpdateQuotaPayload, AssignModeratorPayload } from '@/types/user';
import type { User } from '@/types/user';

export interface UserServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class UserManagementService {
  async getUsers(filters?: { role?: UserRole; isActive?: boolean; search?: string }): Promise<UserServiceResponse<User[]>> {
    try {
      const response = await usersApiClient.getUsers(filters?.role);
      const users = response.items || [];
      return { 
        success: true, 
        data: users.map(userDtoToModel)
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getUser(id: string): Promise<UserServiceResponse<User>> {
    try {
      const user = await usersApiClient.getUserById(parseInt(id, 10));
      return { success: true, data: userDtoToModel(user) };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getModerators(): Promise<UserServiceResponse<User[]>> {
    try {
      const response = await usersApiClient.getModerators();
      const moderators = response.items || [];
      return {
        success: true,
        data: moderators.map(userDtoToModel),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch moderators: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async createUser(payload: any): Promise<UserServiceResponse<User>> {
    try {
      // Defensive: coerce moderatorId to number if provided as string
      if (payload.moderatorId && typeof payload.moderatorId === 'string') {
        payload.moderatorId = parseInt(payload.moderatorId, 10);
        if (Number.isNaN(payload.moderatorId)) {
          return {
            success: false,
            error: 'معرّف المشرف غير صالح',
          };
        }
      }

      const user = await usersApiClient.createUser({
        firstName: payload.firstName,
        lastName: payload.lastName || '',
        username: payload.username,
        role: payload.role || 'user',
        moderatorId: payload.moderatorId,
        password: payload.password, // Include password if provided
      });
      return { success: true, data: userDtoToModel(user) };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async updateUser(id: string, payload: any): Promise<UserServiceResponse<User>> {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 UserManagementService.updateUser called with:', {
          userId: id,
          payload: payload,
        });
      }

      const user = await usersApiClient.updateUser(parseInt(id, 10), payload);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ UserManagementService.updateUser received response:', user);
      }

      return { success: true, data: userDtoToModel(user) };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ UserManagementService.updateUser error:', {
          error: error,
          errorMsg: errorMsg,
        });
      }

      return {
        success: false,
        error: `Failed to update user: ${errorMsg}`,
      };
    }
  }

  async deleteUser(id: string): Promise<UserServiceResponse<void>> {
    try {
      await usersApiClient.deleteUser(parseInt(id, 10));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

const userManagementService = new UserManagementService();
export { userManagementService };
export default userManagementService;
