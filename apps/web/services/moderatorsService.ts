/**
 * Moderators Service
 * Handles all moderator-related API operations
 * Using mock data for frontend development
 */

'use client';

import {
  MOCK_USERS,
  MOCK_MODERATOR_SETTINGS,
  MOCK_QUOTAS,
  getModerator,
  getAllModerators,
  getUsersUnderModerator,
  getModeratorQuota,
  getModeratorSettings,
  getModeratorWhatsAppSession,
  getModeratorMessages,
  getModeratorQueues,
  getModeratorTemplates,
  User,
  Moderator,
  ModeratorSettings,
  Quota,
  WhatsAppSession,
} from './mockDataService';

export interface ModeratorResponse {
  id: number;
  username: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModeratorDetailsResponse extends ModeratorResponse {
  managedUsersCount: number;
  queuesCount: number;
  templatesCount: number;
  quota: Quota;
  settings: ModeratorSettings;
  whatsappSession: WhatsAppSession | null;
}

export interface CreateModeratorRequest {
  fullName: string;
  email: string;
  username: string;
  phoneNumber?: string;
  messagesQuota: number;
  queuesQuota: number;
  whatsAppPhoneNumber?: string;
}

export interface UpdateModeratorRequest {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  whatsAppPhoneNumber?: string;
  isActive?: boolean;
}

export interface AddUserToModeratorRequest {
  fullName: string;
  email: string;
  username: string;
  phoneNumber?: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ModeratorsService {
  /**
   * Get all moderators
   */
  async getAllModerators(): Promise<ServiceResponse<ModeratorDetailsResponse[]>> {
    try {
      const moderators = getAllModerators();
      const details: ModeratorDetailsResponse[] = moderators.map((mod) => ({
        id: mod.id,
        username: mod.username,
        fullName: mod.fullName,
        email: mod.email,
        phoneNumber: mod.phoneNumber,
        isActive: mod.isActive,
        createdAt: mod.createdAt,
        updatedAt: mod.updatedAt,
        managedUsersCount: getUsersUnderModerator(mod.id).length,
        queuesCount: getModeratorQueues(mod.id).length,
        templatesCount: getModeratorTemplates(mod.id).length,
        quota: getModeratorQuota(mod.id)!,
        settings: getModeratorSettings(mod.id)!,
        whatsappSession: getModeratorWhatsAppSession(mod.id) || null,
      }));

      return { success: true, data: details };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch moderators';
      return { success: false, error: message };
    }
  }

  /**
   * Get moderator by ID
   */
  async getModeratorById(moderatorId: number): Promise<ServiceResponse<ModeratorDetailsResponse>> {
    try {
      const moderator = getModerator(moderatorId);
      if (!moderator) {
        return { success: false, error: 'Moderator not found' };
      }

      const response: ModeratorDetailsResponse = {
        id: moderator.id,
        username: moderator.username,
        fullName: moderator.fullName,
        email: moderator.email,
        phoneNumber: moderator.phoneNumber,
        isActive: moderator.isActive,
        createdAt: moderator.createdAt,
        updatedAt: moderator.updatedAt,
        managedUsersCount: getUsersUnderModerator(moderator.id).length,
        queuesCount: getModeratorQueues(moderator.id).length,
        templatesCount: getModeratorTemplates(moderator.id).length,
        quota: getModeratorQuota(moderator.id)!,
        settings: getModeratorSettings(moderator.id)!,
        whatsappSession: getModeratorWhatsAppSession(moderator.id) || null,
      };

      return { success: true, data: response };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch moderator';
      return { success: false, error: message };
    }
  }

  /**
   * Create new moderator
   */
  async createModerator(
    request: CreateModeratorRequest
  ): Promise<ServiceResponse<ModeratorDetailsResponse>> {
    try {
      // In mock mode, create a new moderator object
      const maxId = Math.max(...MOCK_USERS.map((u) => u.id));
      const newModeratorId = maxId + 1;
      const now = new Date();

      const newModerator: Moderator = {
        id: newModeratorId,
        username: request.username,
        fullName: request.fullName,
        email: request.email,
        role: 'moderator',
        phoneNumber: request.phoneNumber,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      // Add to mock data
      MOCK_USERS.push(newModerator);

      // Create settings
      const newSettings: ModeratorSettings = {
        id: Math.max(...MOCK_MODERATOR_SETTINGS.map((s) => s.id)) + 1,
        moderatorUserId: newModeratorId,
        whatsAppPhoneNumber: request.whatsAppPhoneNumber,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      MOCK_MODERATOR_SETTINGS.push(newSettings);

      // Create quota
      const newQuota: Quota = {
        id: Math.max(...MOCK_QUOTAS.map((q) => q.id)) + 1,
        moderatorUserId: newModeratorId,
        messagesQuota: request.messagesQuota,
        consumedMessages: 0,
        queuesQuota: request.queuesQuota,
        consumedQueues: 0,
        remainingMessages: request.messagesQuota,
        remainingQueues: request.queuesQuota,
        updatedAt: now,
        isMessagesQuotaLow: false,
        isQueuesQuotaLow: false,
      };
      MOCK_QUOTAS.push(newQuota);

      const response: ModeratorDetailsResponse = {
        id: newModerator.id,
        username: newModerator.username,
        fullName: newModerator.fullName,
        email: newModerator.email,
        phoneNumber: newModerator.phoneNumber,
        isActive: newModerator.isActive,
        createdAt: newModerator.createdAt,
        updatedAt: newModerator.updatedAt,
        managedUsersCount: 0,
        queuesCount: 0,
        templatesCount: 0,
        quota: newQuota,
        settings: newSettings,
        whatsappSession: null,
      };

      return {
        success: true,
        data: response,
        message: 'Moderator created successfully',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create moderator';
      return { success: false, error: message };
    }
  }

  /**
   * Update moderator
   */
  async updateModerator(
    moderatorId: number,
    request: UpdateModeratorRequest
  ): Promise<ServiceResponse<ModeratorDetailsResponse>> {
    try {
      const moderator = getModerator(moderatorId);
      if (!moderator) {
        return { success: false, error: 'Moderator not found' };
      }

      // Update user
      const userIndex = MOCK_USERS.findIndex((u) => u.id === moderatorId);
      if (userIndex >= 0) {
        if (request.fullName) MOCK_USERS[userIndex].fullName = request.fullName;
        if (request.email) MOCK_USERS[userIndex].email = request.email;
        if (request.phoneNumber) MOCK_USERS[userIndex].phoneNumber = request.phoneNumber;
        if (request.isActive !== undefined) MOCK_USERS[userIndex].isActive = request.isActive;
        MOCK_USERS[userIndex].updatedAt = new Date();
      }

      // Update settings
      const settingsIndex = MOCK_MODERATOR_SETTINGS.findIndex(
        (s) => s.moderatorUserId === moderatorId
      );
      if (settingsIndex >= 0) {
        if (request.whatsAppPhoneNumber) {
          MOCK_MODERATOR_SETTINGS[settingsIndex].whatsAppPhoneNumber = request.whatsAppPhoneNumber;
        }
        MOCK_MODERATOR_SETTINGS[settingsIndex].updatedAt = new Date();
      }

      return this.getModeratorById(moderatorId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update moderator';
      return { success: false, error: message };
    }
  }

  /**
   * Delete moderator
   */
  async deleteModerator(moderatorId: number): Promise<ServiceResponse<void>> {
    try {
      const moderator = getModerator(moderatorId);
      if (!moderator) {
        return { success: false, error: 'Moderator not found' };
      }

      // Check if moderator has managed users
      const managedUsers = getUsersUnderModerator(moderatorId);
      if (managedUsers.length > 0) {
        return { success: false, error: 'Cannot delete moderator with managed users' };
      }

      // Remove moderator
      const userIndex = MOCK_USERS.findIndex((u) => u.id === moderatorId);
      if (userIndex >= 0) {
        MOCK_USERS.splice(userIndex, 1);
      }

      // Remove settings
      const settingsIndex = MOCK_MODERATOR_SETTINGS.findIndex(
        (s) => s.moderatorUserId === moderatorId
      );
      if (settingsIndex >= 0) {
        MOCK_MODERATOR_SETTINGS.splice(settingsIndex, 1);
      }

      // Remove quota
      const quotaIndex = MOCK_QUOTAS.findIndex((q) => q.moderatorUserId === moderatorId);
      if (quotaIndex >= 0) {
        MOCK_QUOTAS.splice(quotaIndex, 1);
      }

      return {
        success: true,
        message: 'Moderator deleted successfully',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete moderator';
      return { success: false, error: message };
    }
  }

  /**
   * Get managed users for a moderator
   */
  async getManagedUsers(moderatorId: number): Promise<ServiceResponse<User[]>> {
    try {
      const moderator = getModerator(moderatorId);
      if (!moderator) {
        return { success: false, error: 'Moderator not found' };
      }

      const users = getUsersUnderModerator(moderatorId);
      return { success: true, data: users };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch managed users';
      return { success: false, error: message };
    }
  }

  /**
   * Add user to moderator
   */
  async addUserToModerator(
    moderatorId: number,
    request: AddUserToModeratorRequest
  ): Promise<ServiceResponse<User>> {
    try {
      const moderator = getModerator(moderatorId);
      if (!moderator) {
        return { success: false, error: 'Moderator not found' };
      }

      // Create new user
      const maxId = Math.max(...MOCK_USERS.map((u) => u.id));
      const newUserId = maxId + 1;
      const now = new Date();

      const newUser: User = {
        id: newUserId,
        username: request.username,
        fullName: request.fullName,
        email: request.email,
        role: 'user',
        phoneNumber: request.phoneNumber,
        moderatorId: moderatorId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      MOCK_USERS.push(newUser);

      return {
        success: true,
        data: newUser,
        message: 'User added to moderator successfully',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add user to moderator';
      return { success: false, error: message };
    }
  }

  /**
   * Remove user from moderator
   */
  async removeUserFromModerator(
    moderatorId: number,
    userId: number
  ): Promise<ServiceResponse<void>> {
    try {
      const moderator = getModerator(moderatorId);
      if (!moderator) {
        return { success: false, error: 'Moderator not found' };
      }

      const userIndex = MOCK_USERS.findIndex((u) => u.id === userId && u.moderatorId === moderatorId);
      if (userIndex < 0) {
        return { success: false, error: 'User not found under this moderator' };
      }

      MOCK_USERS.splice(userIndex, 1);

      return {
        success: true,
        message: 'User removed from moderator successfully',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove user from moderator';
      return { success: false, error: message };
    }
  }

  /**
   * Get WhatsApp session for moderator
   */
  async getWhatsAppSession(moderatorId: number): Promise<ServiceResponse<WhatsAppSession | null>> {
    try {
      const session = getModeratorWhatsAppSession(moderatorId);
      return { success: true, data: session };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch WhatsApp session';
      return { success: false, error: message };
    }
  }
}

export const moderatorsService = new ModeratorsService();
export default moderatorsService;
