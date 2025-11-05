/**
 * Moderator Quota Management Service
 * Handles quota CRUD operations and calculations
 */

import { ModeratorQuota } from '@/types/user';

interface QuotaServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Mock quota storage (in production, this would be backend API calls)
const quotaStorage = new Map<string, ModeratorQuota>();

class ModeratorQuotaService {
  /**
   * Get quota for a moderator
   */
  async getQuota(moderatorId: string): Promise<QuotaServiceResponse<ModeratorQuota>> {
    try {
      const quota = quotaStorage.get(moderatorId);
      if (!quota) {
        // Return default quota if not found
        const defaultQuota: ModeratorQuota = {
          id: `quota-${moderatorId}`,
          moderatorId,
          messagesQuota: {
            limit: -1, // Unlimited by default
            used: 0,
            percentage: 0,
            isLow: false,
            warningThreshold: 80,
          },
          queuesQuota: {
            limit: -1, // Unlimited by default
            used: 0,
            percentage: 0,
            isLow: false,
            warningThreshold: 80,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return { success: true, data: defaultQuota };
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
   * Update quota for a moderator (supports SET or ADD mode)
   * When mode is 'add', the new values are added to existing limits
   * When mode is 'set', the new values replace existing limits
   */
  async updateQuota(
    moderatorId: string,
    updates: Partial<ModeratorQuota>,
    mode: 'set' | 'add' = 'set'
  ): Promise<QuotaServiceResponse<ModeratorQuota>> {
    try {
      const existing = quotaStorage.get(moderatorId);
      const current = existing || {
        id: `quota-${moderatorId}`,
        moderatorId,
        messagesQuota: {
          limit: -1,
          used: 0,
          percentage: 0,
          isLow: false,
          warningThreshold: 80,
        },
        queuesQuota: {
          limit: -1,
          used: 0,
          percentage: 0,
          isLow: false,
          warningThreshold: 80,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Merge updates with mode support
      let updated: ModeratorQuota = {
        ...current,
        moderatorId, // Don't allow changing moderator ID
        updatedAt: new Date(),
      };

      // Handle messages quota
      if (updates.messagesQuota) {
        if (mode === 'add') {
          const addAmount = updates.messagesQuota.limit;
          const currentLimit = current.messagesQuota.limit;
          
          // If current is unlimited (-1), adding keeps it unlimited
          if (currentLimit === -1) {
            updated.messagesQuota = {
              ...current.messagesQuota,
              limit: -1,
            };
          } else if (addAmount === -1) {
            // If adding unlimited, result is unlimited
            updated.messagesQuota = {
              ...current.messagesQuota,
              limit: -1,
            };
          } else {
            // Add to existing limit
            updated.messagesQuota = {
              ...current.messagesQuota,
              limit: currentLimit + addAmount,
            };
          }
        } else {
          // SET mode - replace the value
          updated.messagesQuota = {
            ...current.messagesQuota,
            limit: updates.messagesQuota.limit,
          };
        }
      }

      // Handle queues quota
      if (updates.queuesQuota) {
        if (mode === 'add') {
          const addAmount = updates.queuesQuota.limit;
          const currentLimit = current.queuesQuota.limit;
          
          // If current is unlimited (-1), adding keeps it unlimited
          if (currentLimit === -1) {
            updated.queuesQuota = {
              ...current.queuesQuota,
              limit: -1,
            };
          } else if (addAmount === -1) {
            // If adding unlimited, result is unlimited
            updated.queuesQuota = {
              ...current.queuesQuota,
              limit: -1,
            };
          } else {
            // Add to existing limit
            updated.queuesQuota = {
              ...current.queuesQuota,
              limit: currentLimit + addAmount,
            };
          }
        } else {
          // SET mode - replace the value
          updated.queuesQuota = {
            ...current.queuesQuota,
            limit: updates.queuesQuota.limit,
          };
        }
      }

      // Recalculate percentages and warnings
      if (updated.messagesQuota.limit > 0) {
        updated.messagesQuota.percentage = Math.round(
          (updated.messagesQuota.used / updated.messagesQuota.limit) * 100
        );
        updated.messagesQuota.isLow =
          updated.messagesQuota.percentage >= updated.messagesQuota.warningThreshold;
      } else {
        updated.messagesQuota.percentage = 0;
        updated.messagesQuota.isLow = false;
      }

      if (updated.queuesQuota.limit > 0) {
        updated.queuesQuota.percentage = Math.round(
          (updated.queuesQuota.used / updated.queuesQuota.limit) * 100
        );
        updated.queuesQuota.isLow =
          updated.queuesQuota.percentage >= updated.queuesQuota.warningThreshold;
      } else {
        updated.queuesQuota.percentage = 0;
        updated.queuesQuota.isLow = false;
      }

      quotaStorage.set(moderatorId, updated);
      return { success: true, data: { ...updated } };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update quota: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Add usage to quota (accumulative)
   */
  async addUsage(
    moderatorId: string,
    type: 'messages' | 'queues',
    amount: number
  ): Promise<QuotaServiceResponse<ModeratorQuota>> {
    try {
      const quotaResult = await this.getQuota(moderatorId);
      if (!quotaResult.success || !quotaResult.data) {
        return quotaResult;
      }

      const quota = quotaResult.data;

      if (type === 'messages') {
        quota.messagesQuota.used += amount;
      } else {
        quota.queuesQuota.used += amount;
      }

      return this.updateQuota(moderatorId, quota);
    } catch (error) {
      return {
        success: false,
        error: `Failed to add usage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if moderator can perform action
   */
  async canPerformAction(
    moderatorId: string,
    type: 'messages' | 'queues'
  ): Promise<boolean> {
    try {
      const quotaResult = await this.getQuota(moderatorId);
      if (!quotaResult.success || !quotaResult.data) {
        return false;
      }

      const quota = quotaResult.data;
      const quotaType =
        type === 'messages' ? quota.messagesQuota : quota.queuesQuota;

      // If limit is -1, it's unlimited
      if (quotaType.limit === -1) {
        return true;
      }

      return quotaType.used < quotaType.limit;
    } catch {
      return false;
    }
  }

  /**
   * Get all quotas (for admin view)
   */
  async getAllQuotas(): Promise<QuotaServiceResponse<ModeratorQuota[]>> {
    try {
      const quotas = Array.from(quotaStorage.values());
      return { success: true, data: quotas };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch quotas: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Reset quota storage (for testing/demo)
   */
  clearAllQuotas(): void {
    quotaStorage.clear();
  }
}

export const moderatorQuotaService = new ModeratorQuotaService();
export default moderatorQuotaService;
