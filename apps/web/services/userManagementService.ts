/**
 * User Management Service - API-Driven
 */
import { UserRole } from '@/types/roles';
import { usersApiClient, userDtoToModel } from '@/services/api/usersApiClient';
import logger from '@/utils/logger';
import { getErrorMessage, translateNetworkError } from '@/utils/errorUtils';

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
      const errorMessage = getErrorMessage(error, 'Unknown error');
      // Error messages from API clients are usually already translated; keep a safe fallback
      const translatedError = translateNetworkError(error);
      return {
        success: false,
        error: errorMessage === 'Unknown error' ? (translatedError || 'فشل في جلب المستخدمين') : (errorMessage || 'فشل في جلب المستخدمين'),
      };
    }
  }

  async getUser(id: string): Promise<UserServiceResponse<User>> {
    try {
      const user = await usersApiClient.getUserById(parseInt(id, 10));
      return { success: true, data: userDtoToModel(user) };
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'Unknown error');
      const translatedError = translateNetworkError(error);
      return {
        success: false,
        error: errorMessage === 'Unknown error' ? (translatedError || 'فشل في جلب المستخدم') : (errorMessage || 'فشل في جلب المستخدم'),
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
      const errorMessage = getErrorMessage(error, 'Unknown error');
      const translatedError = translateNetworkError(error);
      return {
        success: false,
        error: errorMessage === 'Unknown error' ? (translatedError || 'فشل في جلب المشرفين') : (errorMessage || 'فشل في جلب المشرفين'),
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
      // Extract error message from ApiError or Error object
      let errorMessage = 'Unknown error';
      
      if (error && typeof error === 'object') {
        // Check for ApiError format (has message property)
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;
        }
        // Check for standard Error object
        else if (error instanceof Error) {
          errorMessage = error.message;
        }
        // Check for error property in object
        else if ('error' in error && typeof error.error === 'string') {
          errorMessage = error.error;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage || 'Failed to create user',
      };
    }
  }

  async updateUser(id: string, payload: any): Promise<UserServiceResponse<User>> {
    try {
      logger.debug('🔄 UserManagementService.updateUser called with:', {
        userId: id,
        payload,
      });

      const user = await usersApiClient.updateUser(parseInt(id, 10), payload);
      
      logger.debug('✅ UserManagementService.updateUser received response:', user);

      return { success: true, data: userDtoToModel(user) };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error && typeof error === 'object' && 'message' in error)
          ? String((error as { message?: unknown }).message || 'Unknown error')
          : 'Unknown error';
      
      logger.error('❌ UserManagementService.updateUser error:', {
        error: errorMessage,
        statusCode: (error && typeof error === 'object' && 'statusCode' in error) ? (error as { statusCode?: unknown }).statusCode : undefined,
        errorMsg,
        fullError: error,
      });

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
