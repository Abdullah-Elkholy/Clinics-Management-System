/**
 * DEPRECATED: Moderators Service
 * 
 * This service is no longer maintained and should not be used.
 * All moderator operations are now handled through:
 * - QueueContext: For template/condition management and moderator aggregation
 * - usersApiClient: For user/moderator data fetching
 * - messageApiClient: For message and quota operations
 * 
 * To migrate from this service:
 * 1. Replace moderator fetching with usersApiClient.getUsers({ role: 'moderator' })
 * 2. Use QueueContext for template/condition mutations with optimistic updates
 * 3. Use messageApiClient for quota and message operations
 * 
 * This file is kept only for reference and will be removed in a future version.
 */

'use client';

import { ModeratorQuota } from '@/types/user';

// Type definitions moved from mockDataService
export interface User {
  id: number;
  username: string;
  firstName: string;
  lastName?: string;
  email?: string;
}

export interface Moderator extends User {
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModeratorSettings {
  id: string;
  moderatorId: string;
  defaultQueueId?: string;
  notificationsEnabled: boolean;
  messageTemplate?: string;
}

export interface WhatsAppSession {
  id: string;
  moderatorId: string;
  sessionName: string;
  isActive: boolean;
  createdAt: Date;
}

export interface ModeratorResponse {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModeratorDetailsResponse extends ModeratorResponse {
  managedUsersCount: number;
  queuesCount: number;
  templatesCount: number;
  quota: ModeratorQuota;
  settings: ModeratorSettings;
  whatsappSession: WhatsAppSession | null;
}

export interface CreateModeratorRequest {
  firstName: string;
  lastName: string;
  username: string;
  messagesQuota: number;
  queuesQuota: number;
}

export interface UpdateModeratorRequest {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface AddUserToModeratorRequest {
  firstName: string;
  lastName: string;
  username: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ModeratorsService {
  /**
   * Get all moderators - stub implementation
   * Components should use API clients directly
   */
  async getAllModerators(): Promise<ServiceResponse<ModeratorDetailsResponse[]>> {
    return {
      success: false,
      error: 'Moderators data must be fetched from backend API',
      data: [],
    };
  }

  /**
   * Get moderator by ID - stub implementation
   */
  async getModeratorById(moderatorId: number): Promise<ServiceResponse<ModeratorDetailsResponse>> {
    return {
      success: false,
      error: 'Moderator data must be fetched from backend API',
    };
  }

  /**
   * Create new moderator - stub implementation
   */
  async createModerator(
    request: CreateModeratorRequest
  ): Promise<ServiceResponse<ModeratorDetailsResponse>> {
    return {
      success: false,
      error: 'Moderator creation must be performed via backend API',
    };
  }

  /**
   * Update moderator - stub implementation
   */
  async updateModerator(
    moderatorId: number,
    request: UpdateModeratorRequest
  ): Promise<ServiceResponse<ModeratorDetailsResponse>> {
    return {
      success: false,
      error: 'Moderator updates must be performed via backend API',
    };
  }

  /**
   * Delete moderator - stub implementation
   */
  async deleteModerator(moderatorId: number): Promise<ServiceResponse<void>> {
    return {
      success: false,
      error: 'Moderator deletion must be performed via backend API',
    };
  }

  /**
   * Get managed users for a moderator - stub implementation
   */
  async getManagedUsers(moderatorId: number): Promise<ServiceResponse<User[]>> {
    return {
      success: false,
      error: 'Managed users data must be fetched from backend API',
      data: [],
    };
  }

  /**
   * Add user to moderator - stub implementation
   */
  async addUserToModerator(
    moderatorId: number,
    request: AddUserToModeratorRequest
  ): Promise<ServiceResponse<User>> {
    return {
      success: false,
      error: 'User addition must be performed via backend API',
    };
  }

  /**
   * Remove user from moderator - stub implementation
   */
  async removeUserFromModerator(
    moderatorId: number,
    userId: number
  ): Promise<ServiceResponse<void>> {
    return {
      success: false,
      error: 'User removal must be performed via backend API',
    };
  }

  /**
   * Get WhatsApp session for moderator - stub implementation
   */
  async getWhatsAppSession(moderatorId: number): Promise<ServiceResponse<WhatsAppSession | null>> {
    return {
      success: false,
      error: 'WhatsApp session data must be fetched from backend API',
      data: null,
    };
  }
}

export const moderatorsService = new ModeratorsService();
export default moderatorsService;
